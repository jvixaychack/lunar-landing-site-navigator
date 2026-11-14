import proj4 from 'proj4';
import { register } from 'ol/proj/proj4';
import { get as getProjection } from 'ol/proj';
import type Projection from 'ol/proj/Projection';

export const MOON_RADIUS_M = 1_737_400;

/**
 * IAU2000:30120 is the Lunar South Pole Stereographic projection supported by
 * ASU/NASA Lunaserv WMS (lunar equivalent of terrestrial EPSG:3031).
 */
export const LUNAR_SOUTH_POLE_SRS = 'IAU2000:30120';

/**
 * 80S-90S LOLA 80m DEM extent in South Pole Stereographic meters:
 * 7600 px * 80 m/px = 608,000 m total width -> [-304000, -304000, 304000, 304000].
 */
export const LOLA_SOUTH_POLE_EXTENT: [number, number, number, number] = [
  -304_000,
  -304_000,
  304_000,
  304_000,
];

const LUNAR_STEREO_PROJ4 =
  `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=${MOON_RADIUS_M} +units=m +no_defs`;

let initialized = false;

/**
 * Register the Lunar South Pole Stereographic projection (IAU2000:30120)
 * and EPSG:3031 polar stereographic definition with OpenLayers.
 */
export function ensureLunarProjection(): Projection {
  if (!initialized) {
    proj4.defs(LUNAR_SOUTH_POLE_SRS, LUNAR_STEREO_PROJ4);
    proj4.defs('EPSG:3031', LUNAR_STEREO_PROJ4);
    register(proj4);
    initialized = true;
  }

  const projection = getProjection(LUNAR_SOUTH_POLE_SRS);
  if (!projection) {
    throw new Error(`Failed to register projection ${LUNAR_SOUTH_POLE_SRS}`);
  }
  projection.setExtent([-600_000, -600_000, 600_000, 600_000]);
  return projection;
}

/**
 * Project lunar planetocentric coordinates (latitudeDeg, longitudeDeg in 0..360E)
 * to South Pole Stereographic (x, y) in meters.
 */
export function lunarLatLonToStereo(
  latitudeDeg: number,
  longitudeDeg: number,
): [number, number] {
  const latRad = (latitudeDeg * Math.PI) / 180;
  const lonRad = (longitudeDeg * Math.PI) / 180;
  const colatitude = Math.PI / 2 + latRad;
  const r = 2 * MOON_RADIUS_M * Math.tan(colatitude / 2);
  const x = r * Math.sin(lonRad);
  const y = r * Math.cos(lonRad);
  return [x, y];
}

/**
 * Inverse-project South Pole Stereographic (x, y) in meters
 * to lunar latitudeDeg (-90..0) and east longitudeDeg (0..360).
 */
export function stereoToLunarLatLon(
  x: number,
  y: number,
): { latitudeDeg: number; longitudeDeg: number } {
  const r = Math.hypot(x, y);
  const colatitude = 2 * Math.atan(r / (2 * MOON_RADIUS_M));
  const latitudeDeg = ((colatitude - Math.PI / 2) * 180) / Math.PI;
  let longitudeDeg = (Math.atan2(x, y) * 180) / Math.PI;
  if (longitudeDeg < 0) {
    longitudeDeg += 360;
  }
  return { latitudeDeg, longitudeDeg };
}

export function formatLunarLatLon(latitudeDeg: number, longitudeDeg: number): string {
  const latStr = `${Math.abs(latitudeDeg).toFixed(4)}°S`;
  const normalizedLon = ((longitudeDeg % 360) + 360) % 360;
  const lonStr = `${normalizedLon.toFixed(4)}°E`;
  return `${latStr}, ${lonStr}`;
}
