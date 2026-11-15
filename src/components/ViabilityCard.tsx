import { useMemo } from 'react';
import { Radio, ShieldCheck, Sun } from 'lucide-react';
import type { HourlyPoint } from '../types/lunar';
import { assessViability, RATING_LABEL, VIABILITY_THRESHOLDS, type Rating } from '../utils/viability';

interface ViabilityCardProps {
  hourly: HourlyPoint[];
}

export const RATING_STYLE: Record<Rating, { badge: string; text: string }> = {
  good: { badge: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30', text: 'text-emerald-300' },
  marginal: { badge: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30', text: 'text-amber-300' },
  poor: { badge: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30', text: 'text-rose-300' },
};

function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span
      className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${RATING_STYLE[rating].badge}`}
    >
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          Mission viability (screening)
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
          Overall <RatingBadge rating={viability.overall} />
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              Solar power
            </span>
            <RatingBadge rating={viability.power.rating} />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{viability.power.reason}</p>
        </div>
        <div className="min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Radio className="h-3.5 w-3.5 text-sky-400" />
              Direct-to-Earth comms
            </span>
            <RatingBadge rating={viability.comms.rating} />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{viability.comms.reason}</p>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-slate-500" title={EXPLANATION}>
        A simple screening, not a mission requirement. Hover for the cut-offs, which are set in
        src/utils/viability.ts.
      </p>
    </div>
  );
}
