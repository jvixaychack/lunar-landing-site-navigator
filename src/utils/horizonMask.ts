import type { LunarSite } from '../types/lunar';

/**
 * Browser-side terrain horizon mask for an arbitrary south-pole coordinate.
 *
 * This is a line-by-line port of `compute_horizon_mask_from_dem` in
 * scripts/generate_lunar_data.py, run against the LOLA 80 m DEM tiles written by
 * scripts/build_dem_tiles.py. Keeping the two in step is what makes custom
 * sites comparable with the precomputed ones.
 */

const MOON_RADIUS_M = 1_737_400;
const OBSERVER_HEIGHT_M = 2;
const MAX_DIST_M = 150_000;
const SUB_RAYS_PER_DEG = 3;

/** Rays reach 150 km, so the DEM (about 304 km from the pole) only covers points poleward of this latitude. */
export const CUSTOM_SITE_MAX_LATITUDE_DEG = -85;

export interface DemIndex {
  demSize: number;
  tileSize: number;
  tilesPerSide: number;
  scaleM: number;
  centerOffset: number;
  heightScaleM: number;
}

/** Returns the raw bytes of a file under the DEM tile folder. */
export type TileFetcher = (name: string) => Promise<ArrayBuffer>;

export interface TileLoader {
  getIndex(): Promise<DemIndex>;
  getTile(row: number, col: number): Promise<Int16Array>;
}

export interface HorizonMaskResult {
  surfaceHeightM: number;
  mask: number[];
  tilesLoaded: number;
}

/** Round half to even, matching numpy.rint. */
function rint(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

async function gunzip(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const view = new Uint8Array(bytes);
  // Some static hosts transparently gzip responses, in which case the browser has
  // already decoded them and the magic bytes are gone.
  if (view.length < 2 || view[0] !== 0x1f || view[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

function decodeTile(raw: ArrayBuffer, tileSize: number): Int16Array {
  const delta = new Int16Array(raw);
  if (delta.length !== tileSize * tileSize) {
    throw new Error(`DEM tile has ${delta.length} samples; expected ${tileSize * tileSize}`);
  }
  const out = new Int16Array(delta.length);
  for (let r = 0; r < tileSize; r += 1) {
    const base = r * tileSize;
    let acc = delta[base];
    out[base] = acc;
    for (let c = 1; c < tileSize; c += 1) {
      acc = (acc + delta[base + c]) << 16 >> 16; // 16-bit wrap-around, undoing the encoder
      out[base + c] = acc;
    }
  }
  return out;
}

export function createTileLoader(fetchFile: TileFetcher): TileLoader {
  let indexPromise: Promise<DemIndex> | null = null;
  const tiles = new Map<string, Promise<Int16Array>>();

  const getIndex = () => {
    if (!indexPromise) {
      indexPromise = fetchFile('index.json')
        .then((buf) => JSON.parse(new TextDecoder().decode(buf)) as DemIndex)
        .catch((cause) => {
          indexPromise = null;
          throw cause;
        });
    }
    return indexPromise;
  };

  const getTile = (row: number, col: number) => {
    const key = `${row}_${col}`;
    let pending = tiles.get(key);
    if (!pending) {
      pending = getIndex()
        .then(async (index) => decodeTile(await gunzip(await fetchFile(`r${row}_c${col}.bin`)), index.tileSize))
        .catch((cause) => {
          tiles.delete(key);
          throw cause;
        });
      tiles.set(key, pending);
    }
    return pending;
  };

  return { getIndex, getTile };
}

/** Loader that reads tiles over HTTP from `<base>data/dem/`. */
export function createHttpTileLoader(baseUrl: string): TileLoader {
  const root = `${baseUrl}data/dem/`;
  return createTileLoader(async (name) => {
    const res = await fetch(`${root}${name}`);
    if (!res.ok) throw new Error(`Failed to load DEM tile ${name} (${res.status})`);
    return res.arrayBuffer();
  });
}

function sampleDistancesM(): number[] {
  const out: number[] = [];
  for (let d = 80; d < 10_000; d += 80) out.push(d);
  for (let d = 10_000; d < 50_000; d += 160) out.push(d);
  for (let d = 50_000; d <= MAX_DIST_M + 1; d += 400) out.push(d);
  return out;
}

export async function computeHorizonMask(
  latDeg: number,
  lonDeg: number,
  loader: TileLoader,
): Promise<HorizonMaskResult> {
  const index = await loader.getIndex();
  const { demSize, tileSize, scaleM, centerOffset, heightScaleM } = index;
  const clampPx = (v: number) => Math.min(Math.max(v, 0), demSize - 1);

  // Observer position on the DEM grid.
  const radiusProj0 = 2 * MOON_RADIUS_M * Math.tan((90 - Math.abs(latDeg)) * Math.PI / 360);
  const lonRad0 = (lonDeg * Math.PI) / 180;
  const r0 = clampPx(rint(centerOffset - (radiusProj0 * Math.cos(lonRad0)) / scaleM));
  const c0 = clampPx(rint((radiusProj0 * Math.sin(lonRad0)) / scaleM + centerOffset));

  // Unit vectors and sample pixels for every ray point.
  const phi0 = (latDeg * Math.PI) / 180;
  const lam0 = lonRad0;
  const uHat = [Math.cos(phi0) * Math.cos(lam0), Math.cos(phi0) * Math.sin(lam0), Math.sin(phi0)];
  const eHat = [-Math.sin(lam0), Math.cos(lam0), 0];
  const nHat = [
    uHat[1] * eHat[2] - uHat[2] * eHat[1],
    uHat[2] * eHat[0] - uHat[0] * eHat[2],
    uHat[0] * eHat[1] - uHat[1] * eHat[0],
  ];

  const dists = sampleDistancesM();
  const nDist = dists.length;
  const nRays = 360 * SUB_RAYS_PER_DEG;
  const total = nRays * nDist;
  const ux = new Float64Array(total);
  const uy = new Float64Array(total);
  const uz = new Float64Array(total);
  const rows = new Int32Array(total);
  const cols = new Int32Array(total);
  const needed = new Set<string>();

  for (let i = 0; i < nRays; i += 1) {
    const az = ((i * 360) / nRays) * (Math.PI / 180);
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);
    const dx = sinAz * eHat[0] + cosAz * nHat[0];
    const dy = sinAz * eHat[1] + cosAz * nHat[1];
    const dz = sinAz * eHat[2] + cosAz * nHat[2];
    for (let j = 0; j < nDist; j += 1) {
      const psi = dists[j] / MOON_RADIUS_M;
      const cp = Math.cos(psi);
      const sp = Math.sin(psi);
      const k = i * nDist + j;
      const x = cp * uHat[0] + sp * dx;
      const y = cp * uHat[1] + sp * dy;
      const z = cp * uHat[2] + sp * dz;
      ux[k] = x;
      uy[k] = y;
      uz[k] = z;
      const latP = Math.asin(Math.min(Math.max(z, -1), 1));
      const lonP = Math.atan2(y, x);
      const rp = 2 * MOON_RADIUS_M * Math.tan((Math.PI / 2 - Math.abs(latP)) / 2);
      const col = clampPx(rint((rp * Math.sin(lonP)) / scaleM + centerOffset));
      const row = clampPx(rint(centerOffset - (rp * Math.cos(lonP)) / scaleM));
      cols[k] = col;
      rows[k] = row;
      needed.add(`${Math.floor(row / tileSize)}_${Math.floor(col / tileSize)}`);
    }
  }
  needed.add(`${Math.floor(r0 / tileSize)}_${Math.floor(c0 / tileSize)}`);

  const loaded = new Map<string, Int16Array>();
  await Promise.all(
    [...needed].map(async (key) => {
      const [tr, tc] = key.split('_').map(Number);
      loaded.set(key, await loader.getTile(tr, tc));
    }),
  );
  const heightRaw = (row: number, col: number) => {
    const tile = loaded.get(`${Math.floor(row / tileSize)}_${Math.floor(col / tileSize)}`) as Int16Array;
    return tile[(row % tileSize) * tileSize + (col % tileSize)];
  };

  const surfaceHeightM = heightRaw(r0, c0) * heightScaleM;
  const obsRadius = MOON_RADIUS_M + surfaceHeightM + OBSERVER_HEIGHT_M;
  const p0 = [obsRadius * uHat[0], obsRadius * uHat[1], obsRadius * uHat[2]];

  const mask = new Array<number>(360).fill(-Infinity);
  for (let i = 0; i < nRays; i += 1) {
    let best = -Infinity;
    for (let j = 0; j < nDist; j += 1) {
      const k = i * nDist + j;
      const radius = MOON_RADIUS_M + heightRaw(rows[k], cols[k]) * heightScaleM;
      const dpx = radius * ux[k] - p0[0];
      const dpy = radius * uy[k] - p0[1];
      const dpz = radius * uz[k] - p0[2];
      const dist3d = Math.max(Math.hypot(dpx, dpy, dpz), 1);
      const up = dpx * uHat[0] + dpy * uHat[1] + dpz * uHat[2];
      const elev = Math.asin(Math.min(Math.max(up / dist3d, -1), 1));
      if (elev > best) best = elev;
    }
    const bin = Math.floor(i / SUB_RAYS_PER_DEG);
    const deg = (best * 180) / Math.PI;
    if (deg > mask[bin]) mask[bin] = deg;
  }

  return {
    surfaceHeightM,
    mask: mask.map((v) => Math.round(v * 1e4) / 1e4),
    tilesLoaded: loaded.size,
  };
}

export type CustomSiteInputError = 'latitude' | 'longitude';

export function validateCustomCoordinates(
  latDeg: number,
  lonDeg: number,
): { ok: true } | { ok: false; field: CustomSiteInputError; message: string } {
  if (!Number.isFinite(latDeg) || latDeg > CUSTOM_SITE_MAX_LATITUDE_DEG || latDeg < -90) {
    return {
      ok: false,
      field: 'latitude',
      message: `Latitude must be between -90 and ${CUSTOM_SITE_MAX_LATITUDE_DEG} (the terrain data is only complete poleward of 85°S).`,
    };
  }
  if (!Number.isFinite(lonDeg) || lonDeg < -180 || lonDeg > 360) {
    return { ok: false, field: 'longitude', message: 'Longitude must be between -180 and 360 degrees east.' };
  }
  return { ok: true };
}

export function customSiteId(latDeg: number, lonDeg: number): string {
  return `custom-${latDeg.toFixed(4)}_${lonDeg.toFixed(4)}`;
}

export async function buildCustomSite(
  latDeg: number,
  lonDeg: number,
  loader: TileLoader,
  name?: string,
): Promise<LunarSite> {
  const check = validateCustomCoordinates(latDeg, lonDeg);
  if (!check.ok) throw new Error(check.message);
  const { surfaceHeightM, mask } = await computeHorizonMask(latDeg, lonDeg, loader);
  const lon = lonDeg > 180 ? lonDeg - 360 : lonDeg;
  return {
    id: customSiteId(latDeg, lon),
    name: name?.trim() || `Custom ${latDeg.toFixed(3)}°, ${lon.toFixed(3)}°`,
    role: 'custom',
    description: `User-defined point. Terrain horizon computed in the browser from the LOLA 80 m DEM (surface height ${surfaceHeightM.toFixed(0)} m).`,
    coordinates: {
      latitudeDeg: latDeg,
      longitudeDeg: lon,
      elevationM: surfaceHeightM,
      observerHeightM: OBSERVER_HEIGHT_M,
    },
    horizonMaskDeg: mask,
  };
}
