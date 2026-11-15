#!/usr/bin/env python3
"""Slice the LOLA 80 m south-pole DEM into small static tiles for the browser.

The web app uses these tiles to compute a terrain horizon mask for any
user-entered coordinate, with no server. Each tile is a square block of the
7600 x 7600 int16 DEM, delta-coded along rows and gzip-compressed.

Usage:
    python scripts/build_dem_tiles.py                 # downloads the DEM if needed
    python scripts/build_dem_tiles.py --dem path/to/LDEM_80S_80M.IMG

Output: public/data/dem/index.json and public/data/dem/r<row>_c<col>.bin
"""

from __future__ import annotations

import argparse
import gzip
import json
import urllib.request
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parent.parent
LOLA_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG"
DEFAULT_DEM = REPO_ROOT / ".cache" / "LDEM_80S_80M.IMG"
DEFAULT_OUT = REPO_ROOT / "public" / "data" / "dem"

DEM_SIZE = 7600
TILE_SIZE = 475  # 7600 / 16, so the grid is exactly 16 x 16
LOLA_SCALE_M = 80.0
LOLA_CENTER_OFFSET = 3799.5
LOLA_HEIGHT_SCALE_M = 0.5


def ensure_dem(path: Path) -> Path:
    if path.exists():
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading LOLA DEM to {path} (about 115 MB)...")
    urllib.request.urlretrieve(LOLA_URL, path)
    return path


def encode_tile(tile: np.ndarray) -> bytes:
    """Delta-code each row (first column kept raw), then gzip."""
    delta = tile.copy()
    delta[:, 1:] = tile[:, 1:] - tile[:, :-1]  # int16 wrap-around is intended
    return gzip.compress(delta.astype("<i2").tobytes(), compresslevel=9, mtime=0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dem", type=Path, default=DEFAULT_DEM)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    dem_path = ensure_dem(args.dem)
    dem = np.fromfile(dem_path, dtype="<i2")
    if dem.size != DEM_SIZE * DEM_SIZE:
        raise SystemExit(f"Unexpected DEM size {dem.size}; expected {DEM_SIZE * DEM_SIZE} samples")
    dem = dem.reshape(DEM_SIZE, DEM_SIZE)

    args.out.mkdir(parents=True, exist_ok=True)
    for stale in args.out.glob("r*_c*.bin"):
        stale.unlink()

    tiles_per_side = DEM_SIZE // TILE_SIZE
    total_bytes = 0
    for r in range(tiles_per_side):
        for c in range(tiles_per_side):
            block = dem[r * TILE_SIZE:(r + 1) * TILE_SIZE, c * TILE_SIZE:(c + 1) * TILE_SIZE]
            payload = encode_tile(block)
            (args.out / f"r{r}_c{c}.bin").write_bytes(payload)
            total_bytes += len(payload)

    index = {
        "demSize": DEM_SIZE,
        "tileSize": TILE_SIZE,
        "tilesPerSide": tiles_per_side,
        "scaleM": LOLA_SCALE_M,
        "centerOffset": LOLA_CENTER_OFFSET,
        "heightScaleM": LOLA_HEIGHT_SCALE_M,
        "encoding": "int16-le, row delta-coded, gzip",
    }
    (args.out / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {tiles_per_side ** 2} tiles, {total_bytes / 1e6:.1f} MB total, to {args.out}")


if __name__ == "__main__":
    main()
