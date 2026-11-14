#!/usr/bin/env python3
"""Generate Lunar South Pole seasonal illumination and Earth DTE visibility dataset.

Builds ``public/data/sites.json`` for five Artemis III Lunar South Pole
candidate sites (Shackleton Rim, Malapert Massif, Nobile Rim 1, Connecting
Ridge, and Peak Near Shackleton) plus a nearby Deep Crater Floor comparison
point ~5 km from Shackleton Rim to demonstrate extreme shadow contrast across
three 30-day (720-hour) lunar seasonal windows in 2026-2027:
  - Summer Solstice 2026 (2026-11-14 to 2026-12-13 UTC)
  - Equinox 2027 (2027-01-27 to 2027-02-25 UTC)
  - Winter Solstice 2027 (2027-04-10 to 2027-05-09 UTC)

Note: Because the Moon's 1.54 deg axial tilt regresses with the 18.6-year
lunar nodal precession cycle, lunar seasons follow the ~346.6-day draconic
year rather than Earth's Gregorian solstices and equinoxes.

Ephemeris pipeline:
  1. Primary: NASA JPL Horizons API (DE441, topocentric lunar MEAN_ME frame,
     no atmospheric refraction / AIRLESS).
  2. Deterministic offline fallback: Analytical Sun/Moon ephemeris (Meeus
     Ch. 25 & Ch. 47) combined with Cassini's Laws and physical libration
     equations (Meeus Ch. 53) whenever JPL Horizons is unreachable or
     ``--offline`` is specified.

Topography pipeline:
  Computes 360-degree terrain horizon elevation masks (1-degree azimuth bins,
  accounting for lunar spherical curvature) from the LRO LOLA South Pole 80 m
  DEM (``LDEM_80S_80M.IMG``) when available, or loads the precomputed LRO LOLA
  masks cached in ``scripts/lola_horizon_masks.json``.
"""

test_variable = "Testing GitHub commit and push flow"

from __future__ import annotations

import argparse
import json
import math
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import numpy as np

# Physical & LOLA DEM constants
MOON_RADIUS_KM = 1737.4
MOON_RADIUS_M = 1_737_400.0
AU_KM = 149_597_870.7
OBSERVER_HEIGHT_M = 2.0

LOLA_DEM_SIZE = 7600
LOLA_SCALE_M = 80.0
LOLA_CENTER_OFFSET = 3799.5
LOLA_HEIGHT_SCALE_M = 0.5
LOLA_MAX_HORIZON_DIST_KM = 150.0
LOLA_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_80M.IMG"

HORIZONS_API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"

SEASON_DAYS = 30
SEASON_HOURS = SEASON_DAYS * 24  # 720 hourly steps per 30-day window

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_PATH = REPO_ROOT / "public" / "data" / "sites.json"
DEFAULT_CACHE_DEM_PATH = REPO_ROOT / ".cache" / "LDEM_80S_80M.IMG"
DEFAULT_MASKS_CACHE_PATH = Path(__file__).resolve().parent / "lola_horizon_masks.json"


@dataclass(frozen=True)
class SeasonSpec:
    """Definition of a 30-day Lunar South Pole seasonal evaluation window."""

    id: str
    name: str
    start_utc: datetime
    end_utc: datetime
    description: str


SEASONS: tuple[SeasonSpec, ...] = (
    SeasonSpec(
        id="summer-solstice",
        name="Summer Solstice 2026",
        start_utc=datetime(2026, 11, 14, 0, 0, tzinfo=timezone.utc),
        end_utc=datetime(2026, 12, 13, 23, 0, tzinfo=timezone.utc),
        description=(
            "Lunar South Pole southern summer maximum (sub-solar latitude near "
            "-1.57 deg; peak illumination across high polar rims)."
        ),
    ),
    SeasonSpec(
        id="equinox",
        name="Equinox 2027",
        start_utc=datetime(2027, 1, 27, 0, 0, tzinfo=timezone.utc),
        end_utc=datetime(2027, 2, 25, 23, 0, tzinfo=timezone.utc),
        description=(
            "Lunar South Pole equinox window centered on the 2027-02-11 "
            "equatorial Sun crossing (0 deg sub-solar latitude)."
        ),
    ),
    SeasonSpec(
        id="winter-solstice",
        name="Winter Solstice 2027",
        start_utc=datetime(2027, 4, 10, 0, 0, tzinfo=timezone.utc),
        end_utc=datetime(2027, 5, 9, 23, 0, tzinfo=timezone.utc),
        description=(
            "Lunar South Pole southern winter minimum centered on 2027-04-25 "
            "(sub-solar latitude near +1.56 deg; maximum polar shadowing)."
        ),
    ),
)

DEFAULT_SEASON_ID = "summer-solstice"


@dataclass(frozen=True)
class SiteSpec:
    """Definition of a Lunar South Pole site to evaluate."""

    id: str
    name: str
    role: str
    latitude_deg: float
    longitude_deg: float
    elevation_m: float
    description: str
    comparison_target_id: str | None = None


SITES: tuple[SiteSpec, ...] = (
    SiteSpec(
        id="shackleton-rim",
        name="Shackleton Rim",
        role="candidate",
        latitude_deg=-89.7797,
        longitude_deg=203.6490,
        elevation_m=1736.5,
        description=(
            "High-illumination crest on the rim of Shackleton Crater "
            "(Mazarico Site 4 vicinity), offering prolonged southern summer "
            "sunlight adjacent to permanently shadowed crater interiors."
        ),
    ),
    SiteSpec(
        id="malapert-massif",
        name="Malapert Massif",
        role="candidate",
        latitude_deg=-85.9876,
        longitude_deg=2.0528,
        elevation_m=5172.0,
        description=(
            "Prominent Earth-facing summit massif on the South Pole-Aitken "
            "basin rim (~5.2 km elevation) providing high Direct-to-Earth "
            "communications uptime."
        ),
    ),
    SiteSpec(
        id="nobile-rim-1",
        name="Nobile Rim 1",
        role="candidate",
        latitude_deg=-85.2910,
        longitude_deg=36.9886,
        elevation_m=6772.5,
        description=(
            "Elevated highland massif along the western rim of Nobile Crater, "
            "combining high solar illumination with access to volatile-rich "
            "polar crater margins."
        ),
    ),
    SiteSpec(
        id="connecting-ridge",
        name="Connecting Ridge",
        role="candidate",
        latitude_deg=-89.4380,
        longitude_deg=222.7170,
        elevation_m=1957.5,
        description=(
            "Elevated ridge linking Shackleton and de Gerlache craters with an "
            "unobstructed negative-angle horizon across all azimuths."
        ),
    ),
    SiteSpec(
        id="peak-near-shackleton",
        name="Peak Near Shackleton",
        role="candidate",
        latitude_deg=-88.8092,
        longitude_deg=123.7077,
        elevation_m=1647.5,
        description=(
            "High-standing polar massif neighboring Shackleton Crater with "
            "favorable grazing-angle solar visibility."
        ),
    ),
    SiteSpec(
        id="deep-crater-floor",
        name="Deep Crater Floor",
        role="comparison",
        latitude_deg=-89.7763,
        longitude_deg=159.6417,
        elevation_m=-1355.5,
        description=(
            "Permanently shadowed floor point inside Shackleton Crater located "
            "~5.0 km from Shackleton Rim, demonstrating extreme terrain "
            "occlusion and total absence of direct sunlight and Earth DTE."
        ),
        comparison_target_id="shackleton-rim",
    ),
)


def haversine_lunar_km(lat1_deg: float, lon1_deg: float, lat2_deg: float, lon2_deg: float) -> float:
    """Compute great-circle distance in km on the lunar reference sphere."""
    phi1, lam1, phi2, lam2 = map(math.radians, (lat1_deg, lon1_deg, lat2_deg, lon2_deg))
    dphi = phi2 - phi1
    dlam = lam2 - lam1
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0) ** 2
    return 2.0 * MOON_RADIUS_KM * math.asin(math.sqrt(min(1.0, a)))


def latlon_to_lola_px(lat_deg: float, lon_deg: float) -> tuple[float, float]:
    """Convert planetocentric (lat, east lon) to 0-based LOLA (row, col)."""
    radius_proj = 2.0 * MOON_RADIUS_M * math.tan(math.radians(90.0 - abs(lat_deg)) / 2.0)
    x = radius_proj * math.sin(math.radians(lon_deg))
    y = radius_proj * math.cos(math.radians(lon_deg))
    row = LOLA_CENTER_OFFSET - y / LOLA_SCALE_M
    col = x / LOLA_SCALE_M + LOLA_CENTER_OFFSET
    return row, col


def compute_horizon_mask_from_dem(
    dem: np.ndarray,
    lat_deg: float,
    lon_deg: float,
    observer_height_m: float = OBSERVER_HEIGHT_M,
    max_dist_km: float = LOLA_MAX_HORIZON_DIST_KM,
    sub_rays_per_deg: int = 3,
) -> tuple[float, list[float]]:
    """Compute a 360-degree terrain horizon elevation mask from a LOLA south pole DEM.

    Uses spherical lunar geometry and local East-North-Up (ENU) basis vectors
    at the observer's location to account for lunar curvature over long sightlines.
    Each 1-degree azimuth bin takes the maximum elevation across ``sub_rays_per_deg``
    azimuthal sub-rays marching outward along great circles up to ``max_dist_km``.
    """
    r0_f, c0_f = latlon_to_lola_px(lat_deg, lon_deg)
    r0 = int(np.clip(round(r0_f), 0, LOLA_DEM_SIZE - 1))
    c0 = int(np.clip(round(c0_f), 0, LOLA_DEM_SIZE - 1))
    surface_h_m = float(dem[r0, c0]) * LOLA_HEIGHT_SCALE_M
    obs_alt_m = surface_h_m + observer_height_m

    phi0 = math.radians(lat_deg)
    lam0 = math.radians(lon_deg)
    p0 = (MOON_RADIUS_M + obs_alt_m) * np.array(
        [math.cos(phi0) * math.cos(lam0), math.cos(phi0) * math.sin(lam0), math.sin(phi0)],
        dtype=np.float64,
    )
    u_hat = p0 / np.linalg.norm(p0)
    e_hat = np.array([-math.sin(lam0), math.cos(lam0), 0.0], dtype=np.float64)
    n_hat = np.cross(u_hat, e_hat)

    dists_m = np.concatenate(
        [
            np.arange(80.0, 10_000.0, 80.0),
            np.arange(10_000.0, 50_000.0, 160.0),
            np.arange(50_000.0, max_dist_km * 1000.0 + 1.0, 400.0),
        ]
    )
    total_rays = 360 * sub_rays_per_deg
    az_sub = np.radians(np.linspace(0.0, 360.0, total_rays, endpoint=False))
    psi = dists_m[None, :] / MOON_RADIUS_M

    dir_vecs = np.sin(az_sub)[:, None] * e_hat[None, :] + np.cos(az_sub)[:, None] * n_hat[None, :]
    pts_unit = np.cos(psi)[:, :, None] * u_hat[None, None, :] + np.sin(psi)[:, :, None] * dir_vecs[:, None, :]

    lat_p = np.arcsin(np.clip(pts_unit[:, :, 2], -1.0, 1.0))
    lon_p = np.arctan2(pts_unit[:, :, 1], pts_unit[:, :, 0])
    rp = 2.0 * MOON_RADIUS_M * np.tan((np.pi / 2.0 - np.abs(lat_p)) / 2.0)

    cols = np.clip(np.rint(rp * np.sin(lon_p) / LOLA_SCALE_M + LOLA_CENTER_OFFSET).astype(int), 0, LOLA_DEM_SIZE - 1)
    rows = np.clip(np.rint(LOLA_CENTER_OFFSET - rp * np.cos(lon_p) / LOLA_SCALE_M).astype(int), 0, LOLA_DEM_SIZE - 1)
    heights_m = dem[rows, cols].astype(np.float64) * LOLA_HEIGHT_SCALE_M

    pts = (MOON_RADIUS_M + heights_m)[:, :, None] * pts_unit
    dp = pts - p0[None, None, :]
    dist_3d = np.maximum(np.linalg.norm(dp, axis=2), 1.0)
    up = np.einsum("ijk,k->ij", dp, u_hat)
    elev_deg = np.degrees(np.arcsin(np.clip(up / dist_3d, -1.0, 1.0)))

    mask_360 = elev_deg.max(axis=1).reshape(360, sub_rays_per_deg).max(axis=1)
    return surface_h_m, [round(float(val), 4) for val in mask_360]


def load_or_compute_horizon_masks(
    dem_path: Path | None,
    masks_cache_path: Path,
    fetch_lola: bool = False,
) -> tuple[dict[str, tuple[float, list[float]]], str]:
    """Load 360-deg horizon masks from LOLA DEM or precomputed LOLA mask cache."""
    resolved_dem = dem_path if dem_path is not None else DEFAULT_CACHE_DEM_PATH
    if fetch_lola and not resolved_dem.exists():
        resolved_dem.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading LRO LOLA DEM from {LOLA_URL} ...")
        urllib.request.urlretrieve(LOLA_URL, resolved_dem)

    if resolved_dem.exists():
        dem = np.memmap(resolved_dem, dtype="<i2", mode="r", shape=(LOLA_DEM_SIZE, LOLA_DEM_SIZE))
        masks: dict[str, tuple[float, list[float]]] = {}
        for site in SITES:
            masks[site.id] = compute_horizon_mask_from_dem(dem, site.latitude_deg, site.longitude_deg)
        return masks, "LRO LOLA South Pole 80m DEM (LDEM_80S_80M.IMG)"

    if masks_cache_path.exists():
        payload = json.loads(masks_cache_path.read_text(encoding="utf-8"))
        masks = {
            site_id: (float(entry["elevationM"]), [float(v) for v in entry["horizonMaskDeg"]])
            for site_id, entry in payload["sites"].items()
        }
        return masks, payload.get("topographySource", "LRO LOLA South Pole 80m DEM (cached masks)")

    raise FileNotFoundError(
        f"Neither LOLA DEM ({resolved_dem}) nor cached horizon masks ({masks_cache_path}) were found."
    )


def export_horizon_masks_cache(dem_path: Path, masks_cache_path: Path) -> None:
    """Compute horizon masks from LOLA DEM and write compact JSON cache."""
    dem = np.memmap(dem_path, dtype="<i2", mode="r", shape=(LOLA_DEM_SIZE, LOLA_DEM_SIZE))
    out: dict[str, Any] = {
        "topographySource": "LRO LOLA South Pole 80m DEM (LDEM_80S_80M.IMG)",
        "observerHeightM": OBSERVER_HEIGHT_M,
        "maxHorizonDistanceKm": LOLA_MAX_HORIZON_DIST_KM,
        "resolutionDeg": 1,
        "sites": {},
    }
    for site in SITES:
        elev_m, mask = compute_horizon_mask_from_dem(dem, site.latitude_deg, site.longitude_deg)
        out["sites"][site.id] = {
            "latitudeDeg": site.latitude_deg,
            "longitudeDeg": site.longitude_deg,
            "elevationM": elev_m,
            "horizonMaskDeg": mask,
        }
    masks_cache_path.parent.mkdir(parents=True, exist_ok=True)
    masks_cache_path.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")


def build_hourly_timestamps(start_utc: datetime, end_utc: datetime) -> list[datetime]:
    """Return inclusive hourly UTC datetimes from ``start_utc`` through ``end_utc``."""
    total_hours = int((end_utc - start_utc).total_seconds() // 3600) + 1
    return [start_utc + timedelta(hours=h) for h in range(total_hours)]


def fetch_horizons_ephemeris(
    target_id: str,
    lat_deg: float,
    lon_deg: float,
    alt_km: float,
    start_utc: datetime,
    stop_utc: datetime,
    timeout_s: float = 20.0,
) -> tuple[np.ndarray, np.ndarray]:
    """Query NASA JPL Horizons API for airless topocentric Az/El on the Moon (MEAN_ME)."""
    params = {
        "format": "json",
        "COMMAND": target_id,
        "OBJ_DATA": "NO",
        "MAKE_EPHEM": "YES",
        "EPHEM_TYPE": "OBSERVER",
        "CENTER": "coord@301",
        "COORD_TYPE": "GEODETIC",
        "SITE_COORD": f"'{lon_deg:.6f},{lat_deg:.6f},{alt_km:.4f}'",
        "START_TIME": f"'{start_utc.strftime('%Y-%m-%d %H:%M')}'",
        "STOP_TIME": f"'{stop_utc.strftime('%Y-%m-%d %H:%M')}'",
        "STEP_SIZE": "'1 h'",
        "QUANTITIES": "4",
        "APPARENT": "AIRLESS",
        "CSV_FORMAT": "YES",
    }
    url = f"{HORIZONS_API_URL}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=timeout_s) as resp:
        payload = json.loads(resp.read().decode("utf-8"))

    result_text = payload.get("result", "")
    if not result_text:
        raise RuntimeError(f"Empty JPL Horizons response for target {target_id}: {payload}")

    az_list: list[float] = []
    el_list: list[float] = []
    in_data = False
    for line in result_text.splitlines():
        stripped = line.strip()
        if stripped == "$$SOE":
            in_data = True
            continue
        if stripped == "$$EOE":
            break
        if in_data and stripped:
            parts = line.split(",")
            if len(parts) < 5:
                continue
            az_list.append(float(parts[3]))
            el_list.append(float(parts[4]))

    expected_hours = int((stop_utc - start_utc).total_seconds() // 3600) + 1
    if len(az_list) != expected_hours:
        raise RuntimeError(
            f"Expected {expected_hours} Horizons rows for target {target_id}, got {len(az_list)}"
        )

    return np.asarray(az_list, dtype=np.float64) % 360.0, np.asarray(el_list, dtype=np.float64)


# Meeus Ch. 47 ELP-2000/82 truncated periodic terms: (D, M, M', F, amplitude)
_MOON_LON_TERMS = (
    (0, 0, 1, 0, 6288774), (2, 0, -1, 0, 1274027), (2, 0, 0, 0, 658314), (0, 0, 2, 0, 213618),
    (0, 1, 0, 0, -185116), (0, 0, 0, 2, -114332), (2, 0, -2, 0, 58793), (2, -1, -1, 0, 57066),
    (2, 0, 1, 0, 53322), (2, -1, 0, 0, 45758), (0, 1, -1, 0, -40923), (1, 0, 0, 0, -34720),
    (0, 1, 1, 0, -30383), (2, 0, 0, -2, 15327), (0, 0, 1, 2, -12528), (0, 0, 1, -2, 10980),
    (4, 0, -1, 0, 10675), (0, 0, 3, 0, 10034), (4, 0, -2, 0, 8548), (2, 1, -1, 0, -7888),
    (2, 1, 0, 0, -6766), (1, 0, -1, 0, -5163), (1, 1, 0, 0, 4987), (2, -1, 1, 0, 4036),
    (2, 0, 2, 0, 3994), (4, 0, 0, 0, 3861), (2, 0, -3, 0, 3665), (0, 1, -2, 0, -2689),
    (2, 0, -1, 2, -2602), (2, -1, -2, 0, 2390), (1, 0, 1, 0, -2348), (2, -2, 0, 0, 2236),
    (0, 1, 2, 0, -2120), (0, 2, 0, 0, -2069), (2, -2, -1, 0, 2048), (2, 0, 1, -2, -1773),
    (2, 0, 0, 2, -1595), (4, -1, -1, 0, 1215), (0, 0, 2, 2, -1110), (3, 0, -1, 0, -892),
    (2, 1, 1, 0, -810), (4, -1, -2, 0, 759), (0, 2, -1, 0, -713), (2, 2, -1, 0, -700),
    (2, 1, -2, 0, 691), (2, -1, 0, -2, 596), (4, 0, 1, 0, 549), (0, 0, 4, 0, 537),
    (4, -1, 0, 0, 520), (1, 0, -2, 0, -487), (2, 1, 0, -2, -399), (0, 0, 2, -2, -381),
    (1, 1, 1, 0, 351), (3, 0, -2, 0, -340), (4, 0, -3, 0, 330), (2, -1, 2, 0, 327),
    (0, 2, 1, 0, -323), (1, 1, -1, 0, 299), (2, 0, 3, 0, 294),
)

_MOON_LAT_TERMS = (
    (0, 0, 0, 1, 5128122), (0, 0, 1, 1, 280602), (0, 0, 1, -1, 277693), (2, 0, 0, -1, 173237),
    (2, 0, -1, 1, 55413), (2, 0, -1, -1, 46271), (2, 0, 0, 1, 32573), (0, 0, 2, 1, 17198),
    (2, 0, 1, -1, 9266), (0, 0, 2, -1, 8822), (2, -1, 0, -1, 8216), (2, 0, -2, -1, 4324),
    (2, 0, 1, 1, 4200), (2, 1, 0, -1, -3359), (2, -1, -1, 1, 2463), (2, -1, 0, 1, 2211),
    (2, -1, -1, -1, 2065), (0, 1, -1, -1, -1870), (4, 0, -1, -1, 1828), (0, 1, 0, 1, -1794),
    (0, 0, 0, 3, -1749), (0, 1, -1, 1, -1565), (1, 0, 0, 1, -1491), (0, 1, 1, 1, -1475),
    (0, 1, 1, -1, -1410), (0, 1, 0, -1, -1344), (1, 0, 0, -1, -1335), (0, 0, 3, 1, 1107),
    (4, 0, 0, -1, 1021), (4, 0, -1, 1, 833),
)

_MOON_DIST_TERMS = (
    (0, 0, 1, 0, -20905355), (2, 0, -1, 0, -3699111), (2, 0, 0, 0, -2955968), (0, 0, 2, 0, -569925),
    (0, 1, 0, 0, 48888), (0, 0, 0, 2, -3149), (2, 0, -2, 0, 246158), (2, -1, -1, 0, -152138),
    (2, 0, 1, 0, -170733), (2, -1, 0, 0, -204586), (0, 1, -1, 0, -129620), (1, 0, 0, 0, 108743),
    (0, 1, 1, 0, 104755), (2, 0, 0, -2, 10321), (0, 0, 1, -2, 79661), (4, 0, -1, 0, -34782),
    (0, 0, 3, 0, -23210), (4, 0, -2, 0, -21636), (2, 1, -1, 0, 24208), (2, 1, 0, 0, 30824),
)


def compute_offline_ephemeris(
    timestamps: list[datetime],
    lat_deg: float,
    lon_deg: float,
    alt_km: float,
) -> tuple[tuple[np.ndarray, np.ndarray], tuple[np.ndarray, np.ndarray]]:
    """Deterministic offline Sun & Earth topocentric Az/El using lunar ephemeris + libration.

    Combines Meeus Ch. 25 solar coordinates, Meeus Ch. 47 truncated ELP-2000/82
    lunar coordinates, and Meeus Ch. 53 Cassini's Laws + physical libration
    (rho, I*sigma, tau) to project Sun and Earth vectors into the lunar Mean Earth
    (ME) topocentric East-North-Up frame (no atmospheric refraction).
    """
    jd_utc = np.array([ts.timestamp() / 86400.0 + 2440587.5 for ts in timestamps], dtype=np.float64)
    jde = jd_utc + 69.184 / 86400.0
    t_cen = (jde - 2451545.0) / 36525.0

    # Fundamental Delaunay & lunar arguments (deg -> rad)
    lp = np.radians((218.3164477 + 481267.88123421 * t_cen - 0.0015786 * t_cen**2 + t_cen**3 / 538841 - t_cen**4 / 65194000) % 360.0)
    d = np.radians((297.8501921 + 445267.1114034 * t_cen - 0.0018819 * t_cen**2 + t_cen**3 / 545868 - t_cen**4 / 113065000) % 360.0)
    m_sun = np.radians((357.5291092 + 35999.0502909 * t_cen - 0.0001536 * t_cen**2 + t_cen**3 / 24490000) % 360.0)
    mp = np.radians((134.9633964 + 477198.8675055 * t_cen + 0.0087414 * t_cen**2 + t_cen**3 / 69699 - t_cen**4 / 14712000) % 360.0)
    f_arg = np.radians((93.2720950 + 483202.0175233 * t_cen - 0.0036539 * t_cen**2 - t_cen**3 / 3526000 + t_cen**4 / 863310000) % 360.0)
    omega = np.radians((125.0445479 - 1934.1362891 * t_cen + 0.0020754 * t_cen**2 + t_cen**3 / 467441 - t_cen**4 / 60616000) % 360.0)

    e_ecc = 1.0 - 0.002516 * t_cen - 0.0000074 * t_cen**2
    a1 = np.radians((119.75 + 131.849 * t_cen) % 360.0)
    a2 = np.radians((53.09 + 479264.290 * t_cen) % 360.0)
    a3 = np.radians((313.45 + 481266.484 * t_cen) % 360.0)

    # Geocentric Sun vector in ecliptic-of-date (km)
    l0 = (280.46646 + 36000.76983 * t_cen + 0.0003032 * t_cen**2) % 360.0
    c_sun = (
        (1.914602 - 0.004817 * t_cen - 0.000014 * t_cen**2) * np.sin(m_sun)
        + (0.019993 - 0.000101 * t_cen) * np.sin(2.0 * m_sun)
        + 0.000289 * np.sin(3.0 * m_sun)
    )
    sun_lon = np.radians(l0 + c_sun - 0.00569 - 0.00478 * np.sin(omega))
    e_sun = 0.016708634 - 0.000042037 * t_cen - 0.0000001267 * t_cen**2
    nu_sun = m_sun + np.radians(c_sun)
    r_sun_km = AU_KM * (1.000001018 * (1.0 - e_sun**2)) / (1.0 + e_sun * np.cos(nu_sun))

    v_e2s_ecl = r_sun_km[:, None] * np.column_stack(
        [np.cos(sun_lon), np.sin(sun_lon), np.zeros_like(sun_lon)]
    )

    # Geocentric Moon vector in ecliptic-of-date (km)
    def _eval_series(terms: tuple[tuple[int, int, int, int, int], ...], use_cos: bool = False) -> np.ndarray:
        acc = np.zeros_like(t_cen)
        for cd, cm, cmp, cf, amp in terms:
            factor = e_ecc if abs(cm) == 1 else (e_ecc**2 if abs(cm) == 2 else 1.0)
            arg = cd * d + cm * m_sun + cmp * mp + cf * f_arg
            acc += amp * factor * (np.cos(arg) if use_cos else np.sin(arg))
        return acc

    s_l = _eval_series(_MOON_LON_TERMS) + 3958.0 * np.sin(a1) + 1962.0 * np.sin(lp - f_arg) + 318.0 * np.sin(a2)
    s_b = (
        _eval_series(_MOON_LAT_TERMS)
        - 2235.0 * np.sin(lp)
        + 382.0 * np.sin(a3)
        + 175.0 * np.sin(a1 - f_arg)
        + 175.0 * np.sin(a1 + f_arg)
        + 127.0 * np.sin(lp - mp)
        - 115.0 * np.sin(lp + mp)
    )
    s_r = _eval_series(_MOON_DIST_TERMS, use_cos=True)

    moon_lon = lp + np.radians(s_l / 1e6)
    moon_lat = np.radians(s_b / 1e6)
    moon_dist_km = 385000.56 + s_r / 1e3

    v_e2m_ecl = moon_dist_km[:, None] * np.column_stack(
        [np.cos(moon_lat) * np.cos(moon_lon), np.cos(moon_lat) * np.sin(moon_lon), np.sin(moon_lat)]
    )
    v_m2s_ecl = v_e2s_ecl - v_e2m_ecl
    v_m2e_ecl = -v_e2m_ecl

    # Cassini's Laws + physical libration (Meeus Ch. 53)
    i_inc = math.radians(1.54242)
    rho = np.radians(
        -0.02752 * np.cos(mp) - 0.02245 * np.sin(f_arg) + 0.00684 * np.cos(mp - 2.0 * f_arg)
        - 0.00293 * np.cos(2.0 * f_arg) - 0.00085 * np.cos(2.0 * (f_arg - d))
        - 0.00054 * np.cos(mp - 2.0 * d) - 0.00020 * np.sin(mp + f_arg)
        - 0.00020 * np.cos(mp + 2.0 * f_arg) - 0.00020 * np.cos(mp - f_arg)
    )
    i_sigma = np.radians(
        -0.02816 * np.sin(mp) + 0.02244 * np.cos(f_arg) - 0.00682 * np.sin(mp - 2.0 * f_arg)
        - 0.00279 * np.sin(2.0 * f_arg) - 0.00083 * np.sin(2.0 * (f_arg - d))
        + 0.00069 * np.sin(mp - 2.0 * d) + 0.00040 * np.cos(mp + f_arg)
        - 0.00025 * np.sin(2.0 * mp)
    )
    tau = np.radians(
        0.02520 * e_ecc * np.sin(m_sun) + 0.00473 * np.sin(2.0 * (mp - f_arg))
        - 0.00467 * np.sin(mp) + 0.00396 * np.sin(a1) + 0.00276 * np.sin(2.0 * (mp - d))
        + 0.00196 * np.sin(omega) - 0.00183 * np.cos(mp - f_arg)
        + 0.00115 * np.sin(mp - 2.0 * d) - 0.00096 * np.sin(mp - d)
    )

    sigma = i_sigma / math.sin(i_inc)
    node_eq = omega + math.pi + sigma
    incl = i_inc + rho
    w_rot = f_arg + tau - sigma

    def _ecl_to_me(v_ecl: np.ndarray) -> np.ndarray:
        c1, s1 = np.cos(node_eq), np.sin(node_eq)
        x1 = c1 * v_ecl[:, 0] + s1 * v_ecl[:, 1]
        y1 = -s1 * v_ecl[:, 0] + c1 * v_ecl[:, 1]
        z1 = v_ecl[:, 2]

        c2, s2 = np.cos(incl), np.sin(incl)
        x2 = x1
        y2 = c2 * y1 + s2 * z1
        z2 = -s2 * y1 + c2 * z1

        c3, s3 = np.cos(w_rot), np.sin(w_rot)
        x3 = c3 * x2 + s3 * y2
        y3 = -s3 * x2 + c3 * y2
        return np.column_stack([x3, y3, z2])

    phi0 = math.radians(lat_deg)
    lam0 = math.radians(lon_deg)
    p0 = (MOON_RADIUS_KM + alt_km) * np.array(
        [math.cos(phi0) * math.cos(lam0), math.cos(phi0) * math.sin(lam0), math.sin(phi0)],
        dtype=np.float64,
    )
    u_hat = p0 / np.linalg.norm(p0)
    e_hat = np.array([-math.sin(lam0), math.cos(lam0), 0.0], dtype=np.float64)
    n_hat = np.cross(u_hat, e_hat)

    def _topo_az_el(v_me: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        dv = v_me - p0[None, :]
        dist = np.linalg.norm(dv, axis=1)
        el = np.degrees(np.arcsin(np.clip((dv @ u_hat) / dist, -1.0, 1.0)))
        az = np.degrees(np.arctan2(dv @ e_hat, dv @ n_hat)) % 360.0
        return az, el

    return _topo_az_el(_ecl_to_me(v_m2s_ecl)), _topo_az_el(_ecl_to_me(v_m2e_ecl))


def interpolate_horizon_mask(mask_360: list[float], azimuth_deg: float) -> float:
    """Linearly interpolate terrain horizon elevation angle at an azimuth in [0, 360)."""
    az = azimuth_deg % 360.0
    i0 = int(math.floor(az)) % 360
    i1 = (i0 + 1) % 360
    frac = az - math.floor(az)
    return mask_360[i0] * (1.0 - frac) + mask_360[i1] * frac


def longest_true_run(flags: list[bool]) -> int:
    """Return the longest consecutive run of True values."""
    best = 0
    current = 0
    for flag in flags:
        if flag:
            current += 1
            if current > best:
                best = current
        else:
            current = 0
    return best


def evaluate_site_season(
    site: SiteSpec,
    season: SeasonSpec,
    elevation_m: float,
    horizon_mask_deg: list[float],
    use_offline: bool = False,
) -> tuple[dict[str, Any], str]:
    """Compute hourly ephemeris, terrain occlusion LOS, and KPIs for one site & season."""
    timestamps = build_hourly_timestamps(season.start_utc, season.end_utc)
    alt_km = (elevation_m + OBSERVER_HEIGHT_M) / 1000.0
    source_used = "NASA JPL Horizons API (DE441)"

    if use_offline:
        (sun_az, sun_el), (earth_az, earth_el) = compute_offline_ephemeris(
            timestamps, site.latitude_deg, site.longitude_deg, alt_km
        )
        source_used = "Offline Lunar Ephemeris + Libration Model"
    else:
        try:
            sun_az, sun_el = fetch_horizons_ephemeris(
                "10", site.latitude_deg, site.longitude_deg, alt_km, season.start_utc, season.end_utc
            )
            earth_az, earth_el = fetch_horizons_ephemeris(
                "399", site.latitude_deg, site.longitude_deg, alt_km, season.start_utc, season.end_utc
            )
        except (urllib.error.URLError, TimeoutError, OSError, RuntimeError, ValueError) as exc:
            print(
                f"[WARN] JPL Horizons unreachable for {site.name} ({season.id}: {exc}); "
                "falling back to offline ephemeris."
            )
            (sun_az, sun_el), (earth_az, earth_el) = compute_offline_ephemeris(
                timestamps, site.latitude_deg, site.longitude_deg, alt_km
            )
            source_used = "Offline Lunar Ephemeris + Libration Model"

    hourly_rows: list[dict[str, Any]] = []
    sun_vis_flags: list[bool] = []
    earth_vis_flags: list[bool] = []

    for idx, ts in enumerate(timestamps):
        s_az = round(float(sun_az[idx]) % 360.0, 4)
        if s_az >= 360.0:
            s_az = 0.0
        s_el = round(float(sun_el[idx]), 4)
        s_mask = round(interpolate_horizon_mask(horizon_mask_deg, s_az), 4)
        s_vis = bool(s_el > s_mask)

        e_az = round(float(earth_az[idx]) % 360.0, 4)
        if e_az >= 360.0:
            e_az = 0.0
        e_el = round(float(earth_el[idx]), 4)
        e_mask = round(interpolate_horizon_mask(horizon_mask_deg, e_az), 4)
        e_vis = bool(e_el > e_mask)

        sun_vis_flags.append(s_vis)
        earth_vis_flags.append(e_vis)

        hourly_rows.append(
            {
                "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "sunAzimuthDeg": s_az,
                "sunElevationDeg": s_el,
                "sunHorizonMaskDeg": s_mask,
                "sunVisible": s_vis,
                "earthAzimuthDeg": e_az,
                "earthElevationDeg": e_el,
                "earthHorizonMaskDeg": e_mask,
                "earthVisible": e_vis,
            }
        )

    sun_vis_hours = sum(sun_vis_flags)
    earth_vis_hours = sum(earth_vis_flags)
    n_hours = len(timestamps)

    season_payload = {
        "kpis": {
            "solarPowerAvailabilityPct": round(100.0 * sun_vis_hours / n_hours, 2),
            "continuousSunlightHours": longest_true_run(sun_vis_flags),
            "dteCommsUptimePct": round(100.0 * earth_vis_hours / n_hours, 2),
            "sunVisibleHours": sun_vis_hours,
            "earthVisibleHours": earth_vis_hours,
            "minSunElevationDeg": round(min(r["sunElevationDeg"] for r in hourly_rows), 2),
            "maxSunElevationDeg": round(max(r["sunElevationDeg"] for r in hourly_rows), 2),
            "minEarthElevationDeg": round(min(r["earthElevationDeg"] for r in hourly_rows), 2),
            "maxEarthElevationDeg": round(max(r["earthElevationDeg"] for r in hourly_rows), 2),
            "minHorizonMaskDeg": round(min(horizon_mask_deg), 2),
            "maxHorizonMaskDeg": round(max(horizon_mask_deg), 2),
        },
        "hourly": hourly_rows,
    }
    return season_payload, source_used


def evaluate_site(
    site: SiteSpec,
    elevation_m: float,
    horizon_mask_deg: list[float],
    seasons: tuple[SeasonSpec, ...] = SEASONS,
    use_offline: bool = False,
) -> tuple[dict[str, Any], set[str]]:
    """Evaluate all seasonal windows for a single Lunar South Pole site."""
    comparison_dist_km: float | None = None
    if site.comparison_target_id is not None:
        target = next(s for s in SITES if s.id == site.comparison_target_id)
        comparison_dist_km = round(
            haversine_lunar_km(site.latitude_deg, site.longitude_deg, target.latitude_deg, target.longitude_deg),
            2,
        )

    seasons_data: dict[str, Any] = {}
    sources_used: set[str] = set()
    for season in seasons:
        season_payload, source_used = evaluate_site_season(
            site=site,
            season=season,
            elevation_m=elevation_m,
            horizon_mask_deg=horizon_mask_deg,
            use_offline=use_offline,
        )
        seasons_data[season.id] = season_payload
        sources_used.add(source_used)

    site_record = {
        "id": site.id,
        "name": site.name,
        "role": site.role,
        "description": site.description,
        "coordinates": {
            "latitudeDeg": site.latitude_deg,
            "longitudeDeg": site.longitude_deg,
            "elevationM": round(elevation_m, 2),
            "observerHeightM": OBSERVER_HEIGHT_M,
        },
        "comparisonTargetId": site.comparison_target_id,
        "comparisonDistanceKm": comparison_dist_km,
        "horizonMaskDeg": [round(v, 4) for v in horizon_mask_deg],
        "seasons": seasons_data,
    }
    return site_record, sources_used


def generate_dataset(
    output_path: Path = DEFAULT_OUTPUT_PATH,
    use_offline: bool = False,
    dem_path: Path | None = None,
    masks_cache_path: Path = DEFAULT_MASKS_CACHE_PATH,
    fetch_lola: bool = False,
    seasons: tuple[SeasonSpec, ...] = SEASONS,
) -> dict[str, Any]:
    """Run the multi-season Lunar South Pole ephemeris + LOLA occlusion pipeline and write JSON."""
    masks, topography_source = load_or_compute_horizon_masks(
        dem_path=dem_path,
        masks_cache_path=masks_cache_path,
        fetch_lola=fetch_lola,
    )

    site_records: list[dict[str, Any]] = []
    ephemeris_sources: set[str] = set()
    for site in SITES:
        elev_m, mask = masks[site.id]
        record, site_sources = evaluate_site(
            site=site,
            elevation_m=elev_m,
            horizon_mask_deg=mask,
            seasons=seasons,
            use_offline=use_offline,
        )
        site_records.append(record)
        ephemeris_sources.update(site_sources)

    season_meta = [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "timeRange": {
                "start": s.start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end": s.end_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "stepHours": 1,
                "durationDays": SEASON_DAYS,
                "totalHours": len(build_hourly_timestamps(s.start_utc, s.end_utc)),
            },
        }
        for s in seasons
    ]

    dataset = {
        "metadata": {
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "defaultSeason": seasons[0].id if DEFAULT_SEASON_ID not in {s.id for s in seasons} else DEFAULT_SEASON_ID,
            "seasons": season_meta,
            "body": "Moon (301)",
            "referenceRadiusKm": MOON_RADIUS_KM,
            "coordinateFrame": "MEAN_ME (Mean Earth / Polar Axis)",
            "atmosphericRefraction": False,
            "observerHeightM": OBSERVER_HEIGHT_M,
            "ephemerisSource": ", ".join(sorted(ephemeris_sources)),
            "topographySource": topography_source,
            "horizonMaskResolutionDeg": 1,
        },
        "sites": site_records,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    return dataset


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Lunar South Pole seasonal sites.json dataset.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH, help="Output JSON path.")
    parser.add_argument("--offline", action="store_true", help="Force deterministic offline ephemeris.")
    parser.add_argument("--lola-dem", type=Path, default=None, help="Path to LOLA LDEM_80S_80M.IMG.")
    parser.add_argument("--fetch-lola", action="store_true", help="Download LOLA DEM if missing.")
    parser.add_argument(
        "--export-masks",
        action="store_true",
        help="Export computed LOLA horizon masks to scripts/lola_horizon_masks.json.",
    )
    args = parser.parse_args()

    if args.export_masks:
        dem = args.lola_dem if args.lola_dem is not None else DEFAULT_CACHE_DEM_PATH
        export_horizon_masks_cache(dem, DEFAULT_MASKS_CACHE_PATH)
        print(f"Exported LOLA horizon masks cache to {DEFAULT_MASKS_CACHE_PATH}")

    dataset = generate_dataset(
        output_path=args.output,
        use_offline=args.offline,
        dem_path=args.lola_dem,
        fetch_lola=args.fetch_lola,
    )
    print(f"Wrote {args.output} ({len(dataset['sites'])} sites, {len(dataset['metadata']['seasons'])} seasons)")
    print(f"Ephemeris source: {dataset['metadata']['ephemerisSource']}")
    print(f"Topography source: {dataset['metadata']['topographySource']}")
    for season_info in dataset["metadata"]["seasons"]:
        sid = season_info["id"]
        tr = season_info["timeRange"]
        print(f"\n[{season_info['name']}] ({tr['start']} .. {tr['end']}, {tr['totalHours']}h)")
        for s in dataset["sites"]:
            k = s["seasons"][sid]["kpis"]
            print(
                f"  - {s['name']:22s} | Solar: {k['solarPowerAvailabilityPct']:6.2f}% "
                f"({k['continuousSunlightHours']:3d}h cont.) | DTE: {k['dteCommsUptimePct']:6.2f}%"
            )


if __name__ == "__main__":
    main()
