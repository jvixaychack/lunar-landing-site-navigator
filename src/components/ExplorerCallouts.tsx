import { BookOpen, Eclipse, Orbit, Wind } from 'lucide-react';
import type { LunarSite, SeasonKpis } from '../types/lunar';

interface ExplorerCalloutsProps {
  site: LunarSite;
  kpis: SeasonKpis;
}

export function ExplorerCallouts({ site, kpis }: ExplorerCalloutsProps) {
  const isPsr = kpis.solarPowerAvailabilityPct === 0;

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
        {isPsr
          ? `Because this site sits deep inside a crater, the surrounding walls rise 8°–33° above the horizon—higher than the Sun ever climbs. It has been in total darkness for billions of years, making it a prime vault for ancient water ice, but impossible for solar-powered landers.`
          : `Perched high on elevated terrain, this site looks down over neighboring valleys (negative horizon mask). It captures ${kpis.solarPowerAvailabilityPct.toFixed(0)}% sunlight this month while staying within a short rover drive of permanently shadowed ice traps.`}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* 1. Lunar Shadows */}
        <div className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <Eclipse className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <div className="font-semibold text-white">1. Extreme Polar Shadows</div>
            The Moon&apos;s axis tilts only ~1.5° (compared to Earth&apos;s 23.5°). At the South Pole,
            the Sun circles near the horizon all month. Elevated crater rims enjoy near-continuous
            daylight, while nearby crater floors plunge into permanent −230°C shadow.
          </div>
        </div>

        {/* 2. Zero Atmosphere */}
        <div className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <Wind className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <div className="font-semibold text-white">2. Zero Atmosphere, Razor-Sharp Darkness</div>
            With no air to scatter light or bend sunbeams (zero atmospheric refraction), there is no
            twilight on the Moon. Step 10 meters into a ridge&apos;s shadow and solar panels drop
            instantly from 100% power to zero.
          </div>
        </div>

        {/* 3. Earth Libration Figure-8 */}
        <div className="flex gap-2.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
          <Orbit className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <div className="font-semibold text-white">3. Earth&apos;s Figure-8 Libration Wobble</div>
            Because the Moon is tidally locked, Earth hovers in roughly the same part of the sky—but
            an elliptical orbit and tilted axis make Earth trace a slow figure-8 loop every 27.3 days.
            If that loop dips behind a mountain ridge, Direct-to-Earth (DTE) radio cuts out until
            Earth climbs back into view (or a relay satellite is used).
          </div>
        </div>
      </div>
    </div>
  );
}
