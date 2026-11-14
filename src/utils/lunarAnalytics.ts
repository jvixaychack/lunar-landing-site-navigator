import type { HourlyPoint } from '../types/lunar';

export interface DteWindow {
  startIndex: number;
  endIndex: number;
  durationHours: number;
  startTimestamp: string;
  endTimestamp: string;
}

export interface DteSummary {
  windows: DteWindow[];
  windowCount: number;
  longestWindowHours: number;
  totalVisibleHours: number;
}

/**
 * Computes contiguous Direct-to-Earth (DTE) line-of-sight communication windows
 * from an hourly ephemeris series.
 */
export function computeDteSummary(hourly: HourlyPoint[]): DteSummary {
  const windows: DteWindow[] = [];
  let currentStart: number | null = null;
  let totalVisibleHours = 0;

  for (let i = 0; i < hourly.length; i++) {
    const pt = hourly[i];
    if (pt.earthVisible) {
      totalVisibleHours += 1;
      if (currentStart === null) {
        currentStart = i;
      }
    } else if (currentStart !== null) {
      windows.push({
        startIndex: currentStart,
        endIndex: i - 1,
        durationHours: i - currentStart,
        startTimestamp: hourly[currentStart].timestamp,
        endTimestamp: hourly[i - 1].timestamp,
      });
      currentStart = null;
    }
  }

  if (currentStart !== null && hourly.length > 0) {
    const last = hourly.length - 1;
    windows.push({
      startIndex: currentStart,
      endIndex: last,
      durationHours: hourly.length - currentStart,
      startTimestamp: hourly[currentStart].timestamp,
      endTimestamp: hourly[last].timestamp,
    });
  }

  const longestWindowHours = windows.reduce(
    (max, w) => Math.max(max, w.durationHours),
    0,
  );

  return {
    windows,
    windowCount: windows.length,
    longestWindowHours,
    totalVisibleHours,
  };
}

export interface ShadowSummary {
  maxShadowHours: number;
  totalShadowHours: number;
  shadowWindowCount: number;
}

/**
 * Computes shadow duration statistics (contiguous hours where sunVisible === false)
 * from an hourly ephemeris series.
 */
export function computeShadowSummary(hourly: HourlyPoint[]): ShadowSummary {
  let maxShadowHours = 0;
  let totalShadowHours = 0;
  let shadowWindowCount = 0;
  let currentStreak = 0;

  for (let i = 0; i < hourly.length; i++) {
    if (!hourly[i].sunVisible) {
      totalShadowHours += 1;
      if (currentStreak === 0) {
        shadowWindowCount += 1;
      }
      currentStreak += 1;
      if (currentStreak > maxShadowHours) {
        maxShadowHours = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  return {
    maxShadowHours,
    totalShadowHours,
    shadowWindowCount,
  };
}

/**
 * Converts (azimuthDeg, elevationDeg) into 2D SVG coordinates on a polar sky-plot.
 * Azimuth 0° = North (top), 90° = East (right), clockwise.
 * Elevation `minEl` maps to outer `radius`; `maxEl` maps to center (0).
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  azimuthDeg: number,
  elevationDeg: number,
  minEl: number,
  maxEl: number,
): { x: number; y: number } {
  const clampedEl = Math.max(minEl, Math.min(maxEl, elevationDeg));
  const normalizedR = (maxEl - clampedEl) / (maxEl - minEl);
  const r = normalizedR * radius;
  const theta = ((azimuthDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(theta),
    y: cy + r * Math.sin(theta),
  };
}

/**
 * Inverse of polarToCartesian for interactive hover readouts on the sky-plot.
 */
export function cartesianToPolar(
  cx: number,
  cy: number,
  radius: number,
  x: number,
  y: number,
  minEl: number,
  maxEl: number,
): { azimuthDeg: number; elevationDeg: number; withinPlot: boolean } {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const withinPlot = dist <= radius;

  // atan2(dy, dx) gives 0 at +X (East); shift by +90° so North (-Y) is 0°
  let az = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (az < 0) az += 360;
  if (az >= 360) az -= 360;

  const clampedDist = Math.min(dist, radius);
  const el = maxEl - (clampedDist / radius) * (maxEl - minEl);

  return { azimuthDeg: az, elevationDeg: el, withinPlot };
}

export function formatSignedDeg(deg: number, decimals = 2): string {
  const sign = deg >= 0 ? '+' : '';
  return `${sign}${deg.toFixed(decimals)}°`;
}

export function formatUtcTimestamp(iso: string): {
  dateLabel: string;
  timeLabel: string;
} {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { dateLabel: iso, timeLabel: '' };
  }
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return {
    dateLabel: `${month} ${day}, ${year}`,
    timeLabel: `${hh}:${mm} UTC`,
  };
}
