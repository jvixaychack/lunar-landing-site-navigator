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
    <section className="grid grid-cols-1 gap-5 border-t border-slate-700 pt-3 sm:grid-cols-3 sm:gap-0 sm:[&>*+*]:border-l sm:[&>*+*]:border-slate-700 sm:[&>*+*]:pl-4 sm:[&>*:not(:last-child)]:pr-4">
      {/* 1. Sun elevation Angle */}
      <div className="min-w-0 ">
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-200">
            <Sun className="h-3.5 w-3.5 text-amber-400" />
            Sun elevation
          </span>
          {current && (
            <span
              className={`whitespace-nowrap text-xs ${
                current.sunVisible
                  ? 'text-amber-300'
                  : 'text-slate-400'
              }`}
            >
              {current.sunVisible ? 'Illuminated' : 'Shadowed'}
            </span>
          )}
        </div>

        <div className="mt-2 font-mono text-3xl font-semibold leading-none text-slate-50">
          {current ? formatSignedDeg(current.sunElevationDeg, 2) : '—'}
        </div>

        <div className="mt-1.5 space-y-0.5 text-xs text-slate-400">
          {current && (
            <div className="flex flex-wrap justify-between gap-x-2">
              <span>Above horizon:</span>
              <span
                className={
                  sunClearanceDeg > 0 ? 'font-mono text-sm text-emerald-400' : 'font-mono text-sm text-rose-400'
                }
              >
                {formatSignedDeg(sunClearanceDeg, 2)}
              </span>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>30-day range:</span>
            <span className="ml-auto whitespace-nowrap font-mono text-sm text-slate-300">
              {formatSignedDeg(kpis.minSunElevationDeg, 1)} to{' '}
              {formatSignedDeg(kpis.maxSunElevationDeg, 1)}
            </span>
          </div>
        </div>

        {viewMode === 'explorer' && (
          <p className="mt-2 text-xs leading-snug text-slate-300">
            At the South Pole, the Sun skims sideways near the horizon—even a small ridge casts a
            kilometer-long shadow.
          </p>
        )}
      </div>

      {/* 2. Geometric sunlight availability */}
      <div className="min-w-0 ">
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-200">
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            Sunlight
          </span>
          <span
            className={`whitespace-nowrap text-xs ${
              kpis.sunlightAvailabilityPct >= 75
                ? 'text-emerald-300'
                : kpis.sunlightAvailabilityPct > 0
                  ? 'text-amber-300'
                  : 'text-rose-300'
            }`}
          >
            {kpis.sunlightAvailabilityPct >= 75
              ? 'High'
              : kpis.sunlightAvailabilityPct > 0
                ? 'Partial'
                : 'No sunlight'}
          </span>
        </div>

        <div className="mt-2 font-mono text-3xl font-semibold leading-none text-slate-50">
          {kpis.sunlightAvailabilityPct.toFixed(1)}%
        </div>

        <div className="mt-1.5 space-y-0.5 text-xs text-slate-400">
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Sunlit hours:</span>
            <span className="ml-auto whitespace-nowrap font-mono text-sm text-slate-300">
              {kpis.sunVisibleHours} / {hourly.length}h
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Longest streak:</span>
            <span className="ml-auto whitespace-nowrap font-mono text-sm text-slate-300">{kpis.continuousSunlightHours}h</span>
          </div>
        </div>

        {viewMode === 'explorer' && (
          <p className="mt-2 text-xs leading-snug text-slate-300">
            Direct sunlight can support power generation, but this model does not estimate power,
            thermal balance, or system sizing.
          </p>
        )}
      </div>

      {/* 3. Geometric Earth line-of-sight windows */}
      <div className="min-w-0 ">
        <div className="flex flex-col items-start gap-0.5">
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-200">
            <Radio className="h-3.5 w-3.5 text-sky-400" />
            Earth line of sight
          </span>
          {current && (
            <span
              className={`whitespace-nowrap text-xs ${
                current.earthVisible
                  ? 'text-sky-300'
                  : 'text-rose-300'
              }`}
            >
              {current.earthVisible ? 'Visible' : 'Blocked'}
            </span>
          )}
        </div>

        <div className="mt-2 font-mono text-3xl font-semibold leading-none text-slate-50">
          {kpis.earthLineOfSightPct.toFixed(1)}%
        </div>

        <div className="mt-1.5 space-y-0.5 text-xs text-slate-400">
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Windows:</span>
            <span className="ml-auto whitespace-nowrap font-mono text-sm text-slate-300">
              {earthVisibility.windowCount}{' '}
              {earthVisibility.windowCount === 1 ? 'window' : 'windows'}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-2">
            <span>Longest / total:</span>
            <span className="ml-auto whitespace-nowrap font-mono text-sm text-slate-300">
              {earthVisibility.longestWindowHours}h / {kpis.earthVisibleHours}h
            </span>
          </div>
        </div>

        {viewMode === 'explorer' && (
          <p className="mt-2 text-xs leading-snug text-slate-300">
            This is geometric visibility only; radio link budgets and ground-network availability
            are not modeled.
          </p>
        )}
      </div>
    </section>
  );
}
