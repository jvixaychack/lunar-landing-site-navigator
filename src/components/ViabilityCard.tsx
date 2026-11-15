import { useMemo } from 'react';
import { Radio, Sun } from 'lucide-react';
import type { HourlyPoint } from '../types/lunar';
import { assessViability, RATING_LABEL, VIABILITY_THRESHOLDS, type Rating } from '../utils/viability';

interface ViabilityCardProps {
  hourly: HourlyPoint[];
}

export const RATING_STYLE: Record<Rating, { badge: string; text: string }> = {
  good: { badge: 'text-emerald-300', text: 'text-emerald-300' },
  marginal: { badge: 'text-slate-100', text: 'text-slate-100' },
  poor: { badge: 'text-rose-300', text: 'text-rose-300' },
};

/** Filled, half-filled or empty disc, so the rating never depends on colour alone. */
export function RatingMark({ rating }: { rating: Rating }) {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
      <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.25" />
      {rating === 'good' && <circle cx="6" cy="6" r="4.75" fill="currentColor" />}
      {rating === 'marginal' && <path d="M6 1.25a4.75 4.75 0 0 1 0 9.5z" fill="currentColor" />}
    </svg>
  );
}

function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${RATING_STYLE[rating].badge}`}
    >
      <RatingMark rating={rating} />
      {RATING_LABEL[rating]}
    </span>
  );
}

const t = VIABILITY_THRESHOLDS;
const EXPLANATION =
  `Power: Good needs at least ${t.power.goodMinSunlitPct}% sunlight and no dark spell over ${t.power.goodMaxDarkHours} h; ` +
  `Poor is under ${t.power.poorMaxSunlitPct}% sunlight or a dark spell over ${t.power.poorMinDarkHours} h. ` +
  `Comms: Good needs Earth in view at least ${t.comms.goodMinEarthPct}% of the time; ` +
  `Poor is under ${t.comms.poorMaxEarthPct}% or an outage over ${t.comms.poorMinOutageHours} h.`;

/** Plain-language Good / Marginal / Poor screening for the selected site and 30-day window. */
export function ViabilityCard({ hourly }: ViabilityCardProps) {
  const viability = useMemo(() => assessViability(hourly), [hourly]);
  if (!viability) return null;

  return (
    <section className="border-t border-slate-700 pt-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Mission viability</h3>
        <span className="inline-flex items-center gap-2 text-xs text-slate-400">
          Overall <RatingBadge rating={viability.overall} />
        </span>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="flex items-center justify-between gap-2 text-sm text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              Solar power
            </span>
            <RatingBadge rating={viability.power.rating} />
          </dt>
          <dd className="mt-1 text-xs leading-snug text-slate-400">{viability.power.reason}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center justify-between gap-2 text-sm text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-sky-400" />
              Direct-to-Earth comms
            </span>
            <RatingBadge rating={viability.comms.rating} />
          </dt>
          <dd className="mt-1 text-xs leading-snug text-slate-400">{viability.comms.reason}</dd>
        </div>
      </dl>

      <p className="mt-2 text-xs leading-snug text-slate-500" title={EXPLANATION}>
        A screening estimate, not a mission requirement. Hover for the cut-offs, which are set in
        src/utils/viability.ts.
      </p>
    </section>
  );
}
