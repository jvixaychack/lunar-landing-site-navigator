import { Radio, Sun, Zap } from 'lucide-react';
import type { HourlyPoint, SeasonKpis, ViewMode } from '../types/lunar';
import { computeEarthVisibilitySummary, formatSignedDeg } from '../utils/lunarAnalytics';
import { useMemo } from 'react';

interface KpiCardsProps {
  kpis: SeasonKpis;
  hourly: HourlyPoint[];
  hourIndex: number;
  viewMode: ViewMode;
}

export function KpiCards({ kpis, hourly, hourIndex, viewMode }: KpiCardsProps) {
  const current = hourly[hourIndex] ?? hourly[0];
  const earthVisibility = useMemo(() => computeEarthVisibilitySummary(hourly), [hourly]);

  const sunClearanceDeg = current
    ? current.sunElevationDeg - current.sunHorizonMaskDeg
    : 0;

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {/* 1. Solar Elevation Angle */}
      <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            Solar Elevation
          </span>
          {current && (
            <span
              className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                current.sunVisible
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {current.sunVisible ? 'Illuminated' : 'Shadowed'}
            </span>
          )}
        </div>

        <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-white">
          {current ? formatSignedDeg(current.sunElevationDeg, 2) : '—'}
        </div>

        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-slate-400">
          {current && (
            <div className="flex flex-wrap justify-between gap-x-2">
              <span>Clearance:</span>
              <span
                className={
                  sunClearanceDeg > 0 ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {formatSignedDeg(sunClearanceDeg, 2)}
              </span>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>30d Range:</span>
            <span className="ml-auto whitespace-nowrap text-slate-300">
              {formatSignedDeg(kpis.minSunElevationDeg, 1)} to{' '}
              {formatSignedDeg(kpis.maxSunElevationDeg, 1)}
            </span>
          </div>
        </div>

        {viewMode === 'explorer' && (
          <p className="mt-2 border-t border-slate-800/80 pt-1.5 text-[11px] leading-snug text-slate-300">
            At the South Pole, the Sun skims sideways near the horizon—even a small ridge casts a
            kilometer-long shadow.
          </p>
        )}
      </div>

      {/* 2. Geometric sunlight availability */}
      <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            Sunlight Availability
          </span>
          <span
            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              kpis.sunlightAvailabilityPct >= 75
                ? 'bg-emerald-500/15 text-emerald-300'
                : kpis.sunlightAvailabilityPct > 0
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            {kpis.sunlightAvailabilityPct >= 75
              ? 'High'
              : kpis.sunlightAvailabilityPct > 0
                ? 'Partial'
                : 'No sunlight'}
          </span>
        </div>

        <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-white">
          {kpis.sunlightAvailabilityPct.toFixed(1)}%
        </div>

        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-slate-400">
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Sunlit Hours:</span>
            <span className="ml-auto whitespace-nowrap text-slate-300">
              {kpis.sunVisibleHours} / {hourly.length}h
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Max Streak:</span>
            <span className="ml-auto whitespace-nowrap text-slate-300">{kpis.continuousSunlightHours}h</span>
          </div>
        </div>

        {viewMode === 'explorer' && (
          <p className="mt-2 border-t border-slate-800/80 pt-1.5 text-[11px] leading-snug text-slate-300">
            Direct sunlight can support power generation, but this model does not estimate power,
            thermal balance, or system sizing.
          </p>
        )}
      </div>

      {/* 3. Geometric Earth line-of-sight windows */}
      <div className="min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <Radio className="h-3.5 w-3.5 text-sky-400" />
            Earth LOS
          </span>
          {current && (
            <span
              className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                current.earthVisible
                  ? 'bg-sky-500/15 text-sky-300'
                  : 'bg-rose-500/15 text-rose-300'
              }`}
            >
              {current.earthVisible ? 'Visible' : 'Blocked'}
            </span>
          )}
        </div>

        <div className="mt-2 font-mono text-2xl font-bold tracking-tight text-white">
          {kpis.earthLineOfSightPct.toFixed(1)}%
        </div>

        <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-slate-400">
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Windows:</span>
            <span className="ml-auto whitespace-nowrap text-slate-300">
              {earthVisibility.windowCount}{' '}
              {earthVisibility.windowCount === 1 ? 'window' : 'windows'}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Longest / Total:</span>
            <span className="ml-auto whitespace-nowrap text-slate-300">
              {earthVisibility.longestWindowHours}h / {kpis.earthVisibleHours}h
            </span>
          </div>
        </div>

        {viewMode === 'explorer' && (
          <p className="mt-2 border-t border-slate-800/80 pt-1.5 text-[11px] leading-snug text-slate-300">
            This is geometric visibility only; radio link budgets and ground-network availability
            are not modeled.
          </p>
        )}
      </div>
    </div>
  );
}
