import { BookOpen, Eclipse, Orbit, Wind } from 'lucide-react';
import type { LunarSite, SeasonKpis } from '../types/lunar';

interface ExplorerCalloutsProps {
  site: LunarSite;
  kpis: SeasonKpis;
}

export function ExplorerCallouts({ site, kpis }: ExplorerCalloutsProps) {
  const hasNoSunlightThisWindow = kpis.sunlightAvailabilityPct === 0;

  return (
    <div className="space-y-2.5 rounded-xl border border-sky-500/30 bg-gradient-to-b from-sky-950/35 to-slate-900/70 p-3.5">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-sky-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
          Explorer Guide: Why Site Selection Is Critical
        </h3>
      </div>

      {/* Site-specific takeaway */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-xs leading-relaxed text-slate-200">
        <span className="font-semibold text-amber-300">{site.name}:</span>{' '}
        {hasNoSunlightThisWindow
          ? `The terrain model shows no direct sunlight at this location during the selected 30-day window. This result alone does not establish permanent shadow or the presence of water ice.`
          : `The location receives direct sunlight during ${kpis.sunlightAvailabilityPct.toFixed(0)}% of the selected 30-day window. This is a geometric illumination estimate, not electrical power output or evidence of nearby ice.`}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* 1. Lunar Shadows */}
        <div className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <Eclipse className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <div className="font-semibold text-white">1. Extreme Polar Shadows</div>
            The Moon&apos;s axis tilts about 1.5° relative to its orbital plane. Near the South Pole,
            the Sun can stay close to the horizon; local topography strongly affects direct
            illumination. This 30-day model does not establish permanent shadow or surface temperature.
          </div>
        </div>

        {/* 2. Zero Atmosphere */}
        <div className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <Wind className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <div className="font-semibold text-white">2. Zero Atmosphere, Razor-Sharp Darkness</div>
            With effectively no atmosphere, there is no atmospheric twilight. This model reports
            whether the Sun clears the terrain mask; it does not simulate panel orientation or
            electrical output.
          </div>
        </div>

        {/* 3. Earth Libration Figure-8 */}
        <div className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <Orbit className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <div className="font-semibold text-white">3. Earth&apos;s Figure-8 Libration Wobble</div>
            Because the Moon is tidally locked, Earth hovers in roughly the same part of the sky—but
            an elliptical orbit and tilted axis make Earth trace a slow figure-8 loop over time.
            If that loop dips behind a mountain ridge, geometric Earth line of sight is blocked.
            This model does not evaluate radio hardware, link budgets, or relay availability.
          </div>
        </div>
      </div>
    </div>
  );
}
