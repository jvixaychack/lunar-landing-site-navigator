import { useMemo } from 'react';
import { AlertTriangle, Radio, Sun } from 'lucide-react';
import type { HourlyPoint } from '../types/lunar';
import { computeCountdown, formatDuration, type Countdown, type CountdownBody } from '../utils/countdown';
import { formatUtcTimestamp } from '../utils/lunarAnalytics';

interface CountdownCardsProps {
  hourly: HourlyPoint[];
  hourIndex: number;
}

/** Warn when a visible Sun or Earth is about to drop below the horizon within this many hours. */
const URGENT_HOURS = 24;

const COPY: Record<CountdownBody, { title: string; up: string; down: string; setWord: string; riseWord: string }> = {
  sun: { title: 'Sun', up: 'Sun is up', down: 'Sun is down', setWord: 'Sunset', riseWord: 'Sunrise' },
  earth: { title: 'Earth', up: 'Earth in view', down: 'Earth blocked', setWord: 'Earthset', riseWord: 'Earthrise' },
};

function CountdownCard({ body, countdown }: { body: CountdownBody; countdown: Countdown }) {
  const copy = COPY[body];
  const Icon = body === 'sun' ? Sun : Radio;
  const accent = body === 'sun' ? 'text-amber-400' : 'text-sky-400';
  const eventWord = countdown.visibleNow ? copy.setWord : copy.riseWord;
  const urgent =
    countdown.visibleNow && countdown.hoursToChange !== null && countdown.hoursToChange < URGENT_HOURS;
  const when = countdown.changeAt ? formatUtcTimestamp(countdown.changeAt) : null;

  const valueColor = urgent ? 'text-rose-300' : body === 'sun' ? 'text-amber-300' : 'text-sky-300';

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-slate-200">
          <Icon className={`h-3.5 w-3.5 ${accent}`} />
          {eventWord} in
        </span>
        <span className="text-xs text-slate-400">{countdown.visibleNow ? copy.up : copy.down}</span>
      </div>

      {countdown.hoursToChange !== null ? (
        <>
          <div className={`mt-1 font-mono text-4xl font-semibold leading-none ${valueColor}`}>
            {formatDuration(countdown.hoursToChange)}
          </div>
          {when && (
            <div className="mt-1.5 font-mono text-xs text-slate-400">
              {when.dateLabel}, {when.timeLabel}
            </div>
          )}
          {urgent && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              Under {URGENT_HOURS} h of {body === 'sun' ? 'sunlight' : 'Earth contact'} left
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-1 font-mono text-2xl font-semibold leading-none text-slate-200">
            No {eventWord.toLowerCase()}
          </div>
          <div className="mt-1.5 text-xs leading-snug text-slate-400">
            {countdown.visibleNow
              ? `Stays above the horizon for the rest of this window (at least ${formatDuration(countdown.hoursLeftInWindow)}).`
              : `Stays below the horizon for the rest of this window (at least ${formatDuration(countdown.hoursLeftInWindow)}).`}
          </div>
        </>
      )}
    </div>
  );
}

/** Time until the next sunset/sunrise and Earthset/Earthrise at the selected moment on the timeline. */
export function CountdownCards({ hourly, hourIndex }: CountdownCardsProps) {
  const sun = useMemo(() => computeCountdown(hourly, hourIndex, 'sun'), [hourly, hourIndex]);
  const earth = useMemo(() => computeCountdown(hourly, hourIndex, 'earth'), [hourly, hourIndex]);
  if (!sun || !earth) return null;

  return (
    <section
      className="grid grid-cols-1 gap-4 border-t border-slate-700 pt-3 sm:grid-cols-2 sm:gap-0 sm:[&>*+*]:border-l sm:[&>*+*]:border-slate-700 sm:[&>*+*]:pl-5 sm:[&>*:first-child]:pr-5"
      aria-label="Time until sunset and Earthset"
    >
      <CountdownCard body="sun" countdown={sun} />
      <CountdownCard body="earth" countdown={earth} />
    </section>
  );
}
