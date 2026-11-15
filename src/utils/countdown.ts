import type { HourlyPoint } from '../types/lunar';

export type CountdownBody = 'sun' | 'earth';

export interface Countdown {
  /** Is the body above the terrain horizon at the selected time? */
  visibleNow: boolean;
  /** Hours until it next sets (if visible) or rises (if hidden). null when that does not happen in the data. */
  hoursToChange: number | null;
  /** UTC time of that change, as an ISO string. null when it does not happen in the data. */
  changeAt: string | null;
  /** Hours of data left after the selected time. Only meaningful when hoursToChange is null. */
  hoursLeftInWindow: number;
}

const HOUR_MS = 3_600_000;

function isVisible(point: HourlyPoint, body: CountdownBody): boolean {
  return body === 'sun' ? point.sunVisible : point.earthVisible;
}

/** Degrees the body is above (+) or below (-) the local terrain horizon. */
function clearanceDeg(point: HourlyPoint, body: CountdownBody): number {
  return body === 'sun'
    ? point.sunElevationDeg - point.sunHorizonMaskDeg
    : point.earthElevationDeg - point.earthHorizonMaskDeg;
}

/**
 * Time until the Sun or Earth next crosses the terrain horizon, measured from hourly[index].
 *
 * The data has one point per hour, so the crossing is found between two points and then placed
 * more precisely by linear interpolation of the clearance above the horizon.
 */
export function computeCountdown(
  hourly: HourlyPoint[],
  index: number,
  body: CountdownBody,
): Countdown | null {
  if (hourly.length === 0) return null;
  const start = Math.min(Math.max(0, index), hourly.length - 1);
  const now = hourly[start];
  const visibleNow = isVisible(now, body);
  const nowMs = Date.parse(now.timestamp);

  let changeIndex = -1;
  for (let i = start + 1; i < hourly.length; i += 1) {
    if (isVisible(hourly[i], body) !== visibleNow) {
      changeIndex = i;
      break;
    }
  }

  if (changeIndex === -1) {
    const lastMs = Date.parse(hourly[hourly.length - 1].timestamp);
    const hoursLeft = Number.isFinite(lastMs - nowMs) ? Math.max(0, (lastMs - nowMs) / HOUR_MS) : 0;
    return { visibleNow, hoursToChange: null, changeAt: null, hoursLeftInWindow: hoursLeft };
  }

  const before = hourly[changeIndex - 1];
  const after = hourly[changeIndex];
  const beforeMs = Date.parse(before.timestamp);
  const afterMs = Date.parse(after.timestamp);
  const m0 = clearanceDeg(before, body);
  const m1 = clearanceDeg(after, body);

  // Where between the two points the clearance reaches zero. If the visibility flag and the
  // clearance disagree (rounding at the very edge), fall back to the later point.
  let fraction = 1;
  if (m0 !== m1 && Math.sign(m0) !== Math.sign(m1)) {
    fraction = Math.min(1, Math.max(0, m0 / (m0 - m1)));
  }
  const eventMs = beforeMs + fraction * (afterMs - beforeMs);

  return {
    visibleNow,
    hoursToChange: Math.max(0, (eventMs - nowMs) / HOUR_MS),
    changeAt: new Date(eventMs).toISOString(),
    hoursLeftInWindow: Math.max(0, (Date.parse(hourly[hourly.length - 1].timestamp) - nowMs) / HOUR_MS),
  };
}

/** "3.4 h", "27 h", or "5 d 22 h". */
export function formatDuration(hours: number): string {
  if (hours < 10) return `${hours.toFixed(1)} h`;
  if (hours < 48) return `${Math.round(hours)} h`;
  const total = Math.round(hours);
  const days = Math.floor(total / 24);
  const rest = total % 24;
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`;
}
