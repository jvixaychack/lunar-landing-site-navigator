import type { HourlyPoint, LunarSite, SeasonKpis, SiteSeasonData } from '../types/lunar';

const MOON_RADIUS_KM = 1737.4;
const AU_KM = 149_597_870.7;
const DAY_MS = 86_400_000;

const MOON_LON_TERMS: [number, number, number, number, number][] = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
  [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
  [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
  [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
  [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
  [2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700],
  [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
  [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381],
  [1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330], [2, -1, 2, 0, 327],
  [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
];

const MOON_LAT_TERMS: [number, number, number, number, number][] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237],
  [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198],
  [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211],
  [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
  [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
];

const MOON_DIST_TERMS: [number, number, number, number, number][] = [
  [0, 0, 1, 0, -20905355], [2, 0, -1, 0, -3699111], [2, 0, 0, 0, -2955968], [0, 0, 2, 0, -569925],
  [0, 1, 0, 0, 48888], [0, 0, 0, 2, -3149], [2, 0, -2, 0, 246158], [2, -1, -1, 0, -152138],
  [2, 0, 1, 0, -170733], [2, -1, 0, 0, -204586], [0, 1, -1, 0, -129620], [1, 0, 0, 0, 108743],
  [0, 1, 1, 0, 104755], [2, 0, 0, -2, 10321], [0, 0, 1, -2, 79661], [4, 0, -1, 0, -34782],
  [0, 0, 3, 0, -23210], [4, 0, -2, 0, -21636], [2, 1, -1, 0, 24208], [2, 1, 0, 0, 30824],
];

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function evaluateSeries(
  terms: [number, number, number, number, number][],
  d: number,
  m: number,
  mp: number,
  f: number,
  eccentricity: number,
  useCos = false,
): number {
  return terms.reduce((sum, [cd, cm, cmp, cf, amplitude]) => {
    const factor = Math.abs(cm) === 1 ? eccentricity : Math.abs(cm) === 2 ? eccentricity ** 2 : 1;
    const argument = cd * d + cm * m + cmp * mp + cf * f;
    return sum + amplitude * factor * (useCos ? Math.cos(argument) : Math.sin(argument));
  }, 0);
}

function toMeanEarth(vector: [number, number, number], node: number, inclination: number, rotation: number): [number, number, number] {
  const [x, y, z] = vector;
  const x1 = Math.cos(node) * x + Math.sin(node) * y;
  const y1 = -Math.sin(node) * x + Math.cos(node) * y;
  const y2 = Math.cos(inclination) * y1 + Math.sin(inclination) * z;
  const z2 = -Math.sin(inclination) * y1 + Math.cos(inclination) * z;
  return [
    Math.cos(rotation) * x1 + Math.sin(rotation) * y2,
    -Math.sin(rotation) * x1 + Math.cos(rotation) * y2,
    z2,
  ];
}

function getSunEarthAzEl(
  timestampMs: number,
  site: LunarSite,
): { sunAzimuthDeg: number; sunElevationDeg: number; earthAzimuthDeg: number; earthElevationDeg: number } {
  const jd = timestampMs / DAY_MS + 2440587.5 + 69.184 / DAY_MS;
  const t = (jd - 2451545) / 36525;
  const lp = radians(normalizeDegrees(218.3164477 + 481267.88123421 * t - 0.0015786 * t ** 2 + t ** 3 / 538841 - t ** 4 / 65194000));
  const d = radians(normalizeDegrees(297.8501921 + 445267.1114034 * t - 0.0018819 * t ** 2 + t ** 3 / 545868 - t ** 4 / 113065000));
  const m = radians(normalizeDegrees(357.5291092 + 35999.0502909 * t - 0.0001536 * t ** 2 + t ** 3 / 24490000));
  const mp = radians(normalizeDegrees(134.9633964 + 477198.8675055 * t + 0.0087414 * t ** 2 + t ** 3 / 69699 - t ** 4 / 14712000));
  const f = radians(normalizeDegrees(93.272095 + 483202.0175233 * t - 0.0036539 * t ** 2 - t ** 3 / 3526000 + t ** 4 / 863310000));
  const omega = radians(normalizeDegrees(125.0445479 - 1934.1362891 * t + 0.0020754 * t ** 2 + t ** 3 / 467441 - t ** 4 / 60616000));
  const eccentricity = 1 - 0.002516 * t - 0.0000074 * t ** 2;
  const a1 = radians(normalizeDegrees(119.75 + 131.849 * t));
  const a2 = radians(normalizeDegrees(53.09 + 479264.29 * t));
  const a3 = radians(normalizeDegrees(313.45 + 481266.484 * t));

  const l0 = normalizeDegrees(280.46646 + 36000.76983 * t + 0.0003032 * t ** 2);
  const cSun = (1.914602 - 0.004817 * t - 0.000014 * t ** 2) * Math.sin(m)
    + (0.019993 - 0.000101 * t) * Math.sin(2 * m)
    + 0.000289 * Math.sin(3 * m);
  const sunLon = radians(l0 + cSun - 0.00569 - 0.00478 * Math.sin(omega));
  const eSun = 0.016708634 - 0.000042037 * t - 0.0000001267 * t ** 2;
  const nuSun = m + radians(cSun);
  const sunDistance = AU_KM * (1.000001018 * (1 - eSun ** 2)) / (1 + eSun * Math.cos(nuSun));
  const sunEcliptic: [number, number, number] = [sunDistance * Math.cos(sunLon), sunDistance * Math.sin(sunLon), 0];

  const sLon = evaluateSeries(MOON_LON_TERMS, d, m, mp, f, eccentricity)
    + 3958 * Math.sin(a1) + 1962 * Math.sin(lp - f) + 318 * Math.sin(a2);
  const sLat = evaluateSeries(MOON_LAT_TERMS, d, m, mp, f, eccentricity)
    - 2235 * Math.sin(lp) + 382 * Math.sin(a3) + 175 * Math.sin(a1 - f)
    + 175 * Math.sin(a1 + f) + 127 * Math.sin(lp - mp) - 115 * Math.sin(lp + mp);
  const sDist = evaluateSeries(MOON_DIST_TERMS, d, m, mp, f, eccentricity, true);
  const moonLon = lp + radians(sLon / 1e6);
  const moonLat = radians(sLat / 1e6);
  const moonDistance = 385000.56 + sDist / 1000;
  const moonEcliptic: [number, number, number] = [
    moonDistance * Math.cos(moonLat) * Math.cos(moonLon),
    moonDistance * Math.cos(moonLat) * Math.sin(moonLon),
    moonDistance * Math.sin(moonLat),
  ];
  const sunFromMoon: [number, number, number] = [
    sunEcliptic[0] - moonEcliptic[0],
    sunEcliptic[1] - moonEcliptic[1],
    sunEcliptic[2] - moonEcliptic[2],
  ];
  const earthFromMoon: [number, number, number] = [-moonEcliptic[0], -moonEcliptic[1], -moonEcliptic[2]];

  const rho = radians(
    -0.02752 * Math.cos(mp) - 0.02245 * Math.sin(f) + 0.00684 * Math.cos(mp - 2 * f)
    - 0.00293 * Math.cos(2 * f) - 0.00085 * Math.cos(2 * (f - d))
    - 0.00054 * Math.cos(mp - 2 * d) - 0.00020 * Math.sin(mp + f)
    - 0.00020 * Math.cos(mp + 2 * f) - 0.00020 * Math.cos(mp - f),
  );
  const iSigma = radians(
    -0.02816 * Math.sin(mp) + 0.02244 * Math.cos(f) - 0.00682 * Math.sin(mp - 2 * f)
    - 0.00279 * Math.sin(2 * f) - 0.00083 * Math.sin(2 * (f - d))
    + 0.00069 * Math.sin(mp - 2 * d) + 0.00040 * Math.cos(mp + f)
    - 0.00025 * Math.sin(2 * mp),
  );
  const tau = radians(
    0.02520 * eccentricity * Math.sin(m) + 0.00473 * Math.sin(2 * (mp - f))
    - 0.00467 * Math.sin(mp) + 0.00396 * Math.sin(a1) + 0.00276 * Math.sin(2 * (mp - d))
    + 0.00196 * Math.sin(omega) - 0.00183 * Math.cos(mp - f)
    + 0.00115 * Math.sin(mp - 2 * d) - 0.00096 * Math.sin(mp - d),
  );
  const sigma = iSigma / Math.sin(radians(1.54242));
  const node = omega + Math.PI + sigma;
  const inclination = radians(1.54242) + rho;
  const rotation = f + tau - sigma;

  const lat = radians(site.coordinates.latitudeDeg);
  const lon = radians(site.coordinates.longitudeDeg);
  const siteRadius = MOON_RADIUS_KM + (site.coordinates.elevationM + (site.coordinates.observerHeightM ?? 2)) / 1000;
  const position: [number, number, number] = [
    siteRadius * Math.cos(lat) * Math.cos(lon),
    siteRadius * Math.cos(lat) * Math.sin(lon),
    siteRadius * Math.sin(lat),
  ];
  const up: [number, number, number] = [
    position[0] / siteRadius,
    position[1] / siteRadius,
    position[2] / siteRadius,
  ];
  const east: [number, number, number] = [-Math.sin(lon), Math.cos(lon), 0];
  const north: [number, number, number] = [
    up[1] * east[2] - up[2] * east[1],
    up[2] * east[0] - up[0] * east[2],
    up[0] * east[1] - up[1] * east[0],
  ];

  const azEl = (vector: [number, number, number]) => {
    const meanEarth = toMeanEarth(vector, node, inclination, rotation);
    const delta = meanEarth.map((value, i) => value - position[i]);
    const distance = Math.hypot(...delta);
    const elevation = Math.asin(Math.max(-1, Math.min(1, (delta[0] * up[0] + delta[1] * up[1] + delta[2] * up[2]) / distance)));
    const azimuth = Math.atan2(delta[0] * east[0] + delta[1] * east[1] + delta[2] * east[2], delta[0] * north[0] + delta[1] * north[1] + delta[2] * north[2]);
    return { azimuthDeg: normalizeDegrees((azimuth * 180) / Math.PI), elevationDeg: (elevation * 180) / Math.PI };
  };
  const sun = azEl(sunFromMoon);
  const earth = azEl(earthFromMoon);
  return {
    sunAzimuthDeg: sun.azimuthDeg,
    sunElevationDeg: sun.elevationDeg,
    earthAzimuthDeg: earth.azimuthDeg,
    earthElevationDeg: earth.elevationDeg,
  };
}

function interpolateHorizon(mask: number[], azimuth: number): number {
  const normalized = normalizeDegrees(azimuth);
  const lowerIndex = Math.floor(normalized) % 360;
  const upperIndex = (lowerIndex + 1) % 360;
  const fraction = normalized - Math.floor(normalized);
  return mask[lowerIndex] * (1 - fraction) + mask[upperIndex] * fraction;
}

function buildData(site: LunarSite, startDate: string, coordinates: Record<string, number[]>): SiteSeasonData {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const mask = site.horizonMaskDeg ?? Array(360).fill(0);
  const hourly: HourlyPoint[] = Array.from({ length: 720 }, (_, index) => {
    const timestamp = new Date(startMs + index * 3_600_000);
    const timestampLabel = timestamp.toISOString().replace('.000Z', 'Z');
    const values = coordinates.sunAzimuthDeg
      ? {
          sunAzimuthDeg: coordinates.sunAzimuthDeg[index],
          sunElevationDeg: coordinates.sunElevationDeg[index],
          earthAzimuthDeg: coordinates.earthAzimuthDeg[index],
          earthElevationDeg: coordinates.earthElevationDeg[index],
        }
      : getSunEarthAzEl(startMs + index * 3_600_000, site);
    const sunMask = interpolateHorizon(mask, values.sunAzimuthDeg);
    const earthMask = interpolateHorizon(mask, values.earthAzimuthDeg);
    return {
      timestamp: timestampLabel,
      sunAzimuthDeg: Number(values.sunAzimuthDeg.toFixed(4)),
      sunElevationDeg: Number(values.sunElevationDeg.toFixed(4)),
      sunHorizonMaskDeg: Number(sunMask.toFixed(4)),
      sunVisible: values.sunElevationDeg > sunMask,
      earthAzimuthDeg: Number(values.earthAzimuthDeg.toFixed(4)),
      earthElevationDeg: Number(values.earthElevationDeg.toFixed(4)),
      earthHorizonMaskDeg: Number(earthMask.toFixed(4)),
      earthVisible: values.earthElevationDeg > earthMask,
    };
  });
  const sunElevations = hourly.map((point) => point.sunElevationDeg);
  const earthElevations = hourly.map((point) => point.earthElevationDeg);
  const sunVisible = hourly.map((point) => point.sunVisible);
  const earthVisible = hourly.map((point) => point.earthVisible);
  let longestSunRun = 0;
  let currentSunRun = 0;
  for (const visible of sunVisible) {
    currentSunRun = visible ? currentSunRun + 1 : 0;
    longestSunRun = Math.max(longestSunRun, currentSunRun);
  }
  const sunVisibleHours = sunVisible.filter(Boolean).length;
  const earthVisibleHours = earthVisible.filter(Boolean).length;
  const kpis: SeasonKpis = {
    solarPowerAvailabilityPct: Number((100 * sunVisibleHours / hourly.length).toFixed(2)),
    continuousSunlightHours: longestSunRun,
    dteCommsUptimePct: Number((100 * earthVisibleHours / hourly.length).toFixed(2)),
    sunVisibleHours,
    earthVisibleHours,
    minSunElevationDeg: Number(Math.min(...sunElevations).toFixed(2)),
    maxSunElevationDeg: Number(Math.max(...sunElevations).toFixed(2)),
    minEarthElevationDeg: Number(Math.min(...earthElevations).toFixed(2)),
    maxEarthElevationDeg: Number(Math.max(...earthElevations).toFixed(2)),
    minHorizonMaskDeg: Number(Math.min(...mask).toFixed(2)),
    maxHorizonMaskDeg: Number(Math.max(...mask).toFixed(2)),
  };
  return { kpis, hourly };
}

async function fetchJplEphemeris(site: LunarSite, startDate: string, signal?: AbortSignal): Promise<Record<string, number[]>> {
  const params = new URLSearchParams({
    latDeg: String(site.coordinates.latitudeDeg),
    lonDeg: String(site.coordinates.longitudeDeg),
    altKm: String((site.coordinates.elevationM + (site.coordinates.observerHeightM ?? 2)) / 1000),
    startDate,
  });
  const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL('api/ephemeris', baseUrl);
  url.search = params.toString();
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`JPL Horizons request failed (${response.status})`);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Ephemeris endpoint did not return JSON');
  }
  if (!payload || typeof payload !== 'object' || !('sunAzimuthDeg' in payload)) {
    throw new Error('JPL Horizons returned an invalid ephemeris response');
  }
  const coordinates = payload as Record<string, unknown>;
  const keys = ['sunAzimuthDeg', 'sunElevationDeg', 'earthAzimuthDeg', 'earthElevationDeg'];
  for (const key of keys) {
    const series = coordinates[key];
    if (!Array.isArray(series) || series.length !== 720 || !series.every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error(`JPL Horizons returned an invalid ${key} series`);
    }
  }
  return coordinates as Record<string, number[]>;
}

export async function calculateSiteSeason(
  site: LunarSite,
  startDate: string,
  signal?: AbortSignal,
): Promise<{
  data: SiteSeasonData;
  source: 'NASA JPL Horizons' | 'Offline analytical model';
  sourceDetail?: string;
}> {
  const parsedDate = Date.parse(`${startDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
    || Number.isNaN(parsedDate)
    || new Date(parsedDate).toISOString().slice(0, 10) !== startDate
  ) {
    throw new Error('Choose a valid start date');
  }
  try {
    const coordinates = await fetchJplEphemeris(site, startDate, signal);
    return { data: buildData(site, startDate, coordinates), source: 'NASA JPL Horizons' };
  } catch (error) {
    if (signal?.aborted) throw error;
    const sourceDetail = error instanceof Error ? error.message : 'JPL Horizons request failed';
    return {
      data: buildData(site, startDate, {}),
      source: 'Offline analytical model',
      sourceDetail,
    };
  }
}

