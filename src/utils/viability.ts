import type { HourlyPoint } from '../types/lunar';
import { formatDuration } from './countdown';

/**
 * A simple screening rating of a site and date window for solar power and direct-to-Earth comms.
 *
 * IMPORTANT: these cut-offs are illustrative, chosen to make differences between sites easy to see.
 * They are NOT NASA or mission requirements. A real lander's needs depend on its battery size,
 * power draw, heaters, antenna and operations plan. Change the numbers here to match your
 * team's assumptions; everything else in the app updates automatically.
 */
export const VIABILITY_THRESHOLDS = {
  power: {
    /** Good: at least this share of the window is sunlit AND no dark spell is longer than goodMaxDarkHours. */
    goodMinSunlitPct: 80,
    goodMaxDarkHours: 72,
    /** Poor: less sunlight than this, OR a dark spell longer than this. */
    poorMaxSunlitPct: 40,
    poorMinDarkHours: 336,
  },
  comms: {
    /** Good: Earth is in view at least this share of the window. */
    goodMinEarthPct: 65,
    /** Poor: Earth is in view less than this share, OR is blocked for longer than poorMinOutageHours in a row. */
    poorMaxEarthPct: 30,
    poorMinOutageHours: 336,
  },
} as const;

export type Rating = 'good' | 'marginal' | 'poor';

export interface Assessment {
  rating: Rating;
  /** One plain-language sentence explaining the rating. */
  reason: string;
}

export interface Viability {
  power: Assessment;
  comms: Assessment;
  /** The weaker of the two ratings. */
  overall: Rating;
}

const RANK: Record<Rating, number> = { poor: 0, marginal: 1, good: 2 };

export const RATING_LABEL: Record<Rating, string> = {
  good: 'Good',
  marginal: 'Marginal',
  poor: 'Poor',
};

/** Longest run of consecutive points where `visible` is false. */
function longestGapHours(flags: boolean[]): number {
  let best = 0;
  let current = 0;
  for (const visible of flags) {
    if (visible) {
      current = 0;
    } else {
      current += 1;
      if (current > best) best = current;
    }
  }
  return best;
}

export function worseRating(a: Rating, b: Rating): Rating {
  return RANK[a] <= RANK[b] ? a : b;
}

export function assessViability(hourly: HourlyPoint[]): Viability | null {
  if (hourly.length === 0) return null;
  const total = hourly.length;
  const sun = hourly.map((p) => p.sunVisible);
  const earth = hourly.map((p) => p.earthVisible);
  const sunlitPct = (100 * sun.filter(Boolean).length) / total;
  const earthPct = (100 * earth.filter(Boolean).length) / total;
  const longestDark = longestGapHours(sun);
  const longestOutage = longestGapHours(earth);
  const t = VIABILITY_THRESHOLDS;

  let powerRating: Rating = 'marginal';
  if (sunlitPct < t.power.poorMaxSunlitPct || longestDark > t.power.poorMinDarkHours) powerRating = 'poor';
  else if (sunlitPct >= t.power.goodMinSunlitPct && longestDark <= t.power.goodMaxDarkHours) powerRating = 'good';

  let commsRating: Rating = 'marginal';
  if (earthPct < t.comms.poorMaxEarthPct || longestOutage > t.comms.poorMinOutageHours) commsRating = 'poor';
  else if (earthPct >= t.comms.goodMinEarthPct) commsRating = 'good';

  const powerReason =
    sunlitPct === 0
      ? 'The Sun never clears the terrain in this window.'
      : `Sunlit ${sunlitPct.toFixed(0)}% of the window; longest dark spell ${formatDuration(longestDark)}.`;
  const commsReason =
    earthPct === 0
      ? 'Earth never clears the terrain in this window.'
      : `Earth in view ${earthPct.toFixed(0)}% of the window; longest outage ${formatDuration(longestOutage)}.`;

  return {
    power: { rating: powerRating, reason: powerReason },
    comms: { rating: commsRating, reason: commsReason },
    overall: worseRating(powerRating, commsRating),
  };
}
