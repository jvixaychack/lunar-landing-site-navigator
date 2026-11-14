import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GitCompareArrows,
  MapPin,
  Moon,
  Mountain,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sun,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  LunarSite,
  SeasonMetadata,
  SiteSeasonData,
} from '../types/lunar';
import {
  computeDteSummary,
  computeShadowSummary,
  formatSignedDeg,
  formatUtcTimestamp,
} from '../utils/lunarAnalytics';
import { formatLunarLatLon } from '../utils/lunarProjection';
import { PolarHorizonSkyPlot, type ZoomMode } from './PolarHorizonSkyPlot';
import type { PlaybackSpeed } from './TimelineScrubber';

type CompareMode = 'sites' | 'windows';

interface CompareViewProps {
  sites: LunarSite[];
  seasons: SeasonMetadata[];
  defaultSeasonId: string;
  hourIndex: number;
  onChangeHour: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: PlaybackSpeed;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
}

function getSeasonData(
  site: LunarSite | undefined,
  seasonId: string,
): SiteSeasonData | undefined {
  if (!site?.seasons) return undefined;
  return site.seasons[seasonId] ?? Object.values(site.seasons)[0];
}

function formatDeltaNumber(
  delta: number,
  unit: string,
  decimals = 0,
): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toFixed(decimals)}${unit}`;
}

export function CompareView({
  sites,
  seasons,
  defaultSeasonId,
  hourIndex,
  onChangeHour,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
}: CompareViewProps) {
  const [compareMode, setCompareMode] = useState<CompareMode>('sites');
  const [zoomMode, setZoomMode] = useState<ZoomMode>('wide');

  const defaultSiteA =
    sites.find((s) => s.id === 'shackleton-rim')?.id ?? sites[0]?.id ?? '';
  const defaultSiteB =
    sites.find((s) => s.id === 'deep-crater-floor')?.id ??
    sites[1]?.id ??
    sites[0]?.id ??
    '';

  const defaultSeasonA =
    seasons.find((s) => s.id === defaultSeasonId)?.id ?? seasons[0]?.id ?? '';
  const defaultSeasonB =
    seasons.find((s) => s.id === 'winter-solstice')?.id ??
    seasons[seasons.length - 1]?.id ??
    seasons[0]?.id ??
    '';

  // Mode A ('sites'): two sites on the same seasonal window
  const [sharedSeasonId, setSharedSeasonId] = useState<string>(defaultSeasonA);
  const [siteAId, setSiteAId] = useState<string>(defaultSiteA);
  const [siteBId, setSiteBId] = useState<string>(defaultSiteB);

  // Mode B ('windows'): same site across two seasonal windows
  const [sharedSiteId, setSharedSiteId] = useState<string>(defaultSiteA);
  const [seasonAId, setSeasonAId] = useState<string>(defaultSeasonA);
  const [seasonBId, setSeasonBId] = useState<string>(defaultSeasonB);

  const resolvedSiteA =
    sites.find((s) => s.id === (compareMode === 'sites' ? siteAId : sharedSiteId)) ??
    sites[0];
  const resolvedSiteB =
    sites.find((s) => s.id === (compareMode === 'sites' ? siteBId : sharedSiteId)) ??
    sites[1] ??
    sites[0];

  const resolvedSeasonIdA = compareMode === 'sites' ? sharedSeasonId : seasonAId;
  const resolvedSeasonIdB = compareMode === 'sites' ? sharedSeasonId : seasonBId;

  const resolvedSeasonA =
    seasons.find((s) => s.id === resolvedSeasonIdA) ?? seasons[0];
  const resolvedSeasonB =
    seasons.find((s) => s.id === resolvedSeasonIdB) ?? seasons[0];

  const dataA = getSeasonData(resolvedSiteA, resolvedSeasonIdA);
  const dataB = getSeasonData(resolvedSiteB, resolvedSeasonIdB);

  const shadowA = useMemo(
    () => (dataA ? computeShadowSummary(dataA.hourly) : null),
    [dataA],
  );
  const shadowB = useMemo(
    () => (dataB ? computeShadowSummary(dataB.hourly) : null),
    [dataB],
  );
  const dteA = useMemo(
    () => (dataA ? computeDteSummary(dataA.hourly) : null),
    [dataA],
  );
  const dteB = useMemo(
    () => (dataB ? computeDteSummary(dataB.hourly) : null),
    [dataB],
  );

  if (!resolvedSiteA || !resolvedSiteB || !dataA || !dataB || !shadowA || !shadowB || !dteA || !dteB) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-xs text-slate-400">
        Loading comparison scenarios…
      </div>
    );
  }

  const maxHours = Math.min(dataA.hourly.length, dataB.hourly.length);
  const maxIndex = Math.max(0, maxHours - 1);
  const safeHourIndex = Math.min(Math.max(0, hourIndex), maxIndex);

  const currentA = dataA.hourly[safeHourIndex] ?? dataA.hourly[0];
  const currentB = dataB.hourly[safeHourIndex] ?? dataB.hourly[0];
  const timeA = currentA ? formatUtcTimestamp(currentA.timestamp) : { dateLabel: '—', timeLabel: '' };
  const timeB = currentB ? formatUtcTimestamp(currentB.timestamp) : { dateLabel: '—', timeLabel: '' };

  const dayNumber = Math.floor(safeHourIndex / 24) + 1;
  const totalDays = Math.max(1, Math.round(maxHours / 24));

  const stepBy = (delta: number) => {
    const next = Math.max(0, Math.min(maxIndex, safeHourIndex + delta));
    onChangeHour(next);
  };

  const handleSwap = () => {
    if (compareMode === 'sites') {
      setSiteAId(siteBId);
      setSiteBId(siteAId);
    } else {
      setSeasonAId(seasonBId);
      setSeasonBId(seasonAId);
    }
  };

  const applyShackletonVsCraterPreset = () => {
    setCompareMode('sites');
    const rim = sites.find((s) => s.id === 'shackleton-rim');
    const crater = sites.find((s) => s.id === 'deep-crater-floor');
    if (rim) setSiteAId(rim.id);
    if (crater) setSiteBId(crater.id);
    onChangeHour(0);
  };

  const applySolsticePreset = () => {
    setCompareMode('windows');
    const rim = sites.find((s) => s.id === 'shackleton-rim') ?? sites[0];
    if (rim) setSharedSiteId(rim.id);
    const summer = seasons.find((s) => s.id === 'summer-solstice');
    const winter = seasons.find((s) => s.id === 'winter-solstice');
    if (summer) setSeasonAId(summer.id);
    if (winter) setSeasonBId(winter.id);
    onChangeHour(0);
  };

  // Core delta calculations (B - A)
  const deltaSunlitHours = dataB.kpis.sunVisibleHours - dataA.kpis.sunVisibleHours;
  const deltaSolarPct =
    dataB.kpis.solarPowerAvailabilityPct - dataA.kpis.solarPowerAvailabilityPct;
  const deltaMaxShadow = shadowB.maxShadowHours - shadowA.maxShadowHours;
  const deltaDtePct = dataB.kpis.dteCommsUptimePct - dataA.kpis.dteCommsUptimePct;
  const deltaDteHours = dataB.kpis.earthVisibleHours - dataA.kpis.earthVisibleHours;
  const deltaContinuousSun =
    dataB.kpis.continuousSunlightHours - dataA.kpis.continuousSunlightHours;
  const deltaElevationM =
    resolvedSiteB.coordinates.elevationM - resolvedSiteA.coordinates.elevationM;

  const renderFavorBadge = (
    delta: number,
    higherIsBetter: boolean,
    zeroLabel = 'Equal',
  ) => {
    if (Math.abs(delta) < 0.05) {
      return (
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          {zeroLabel}
        </span>
      );
    }
    const bIsBetter = higherIsBetter ? delta > 0 : delta < 0;
    return (
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
          bIsBetter
            ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
            : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
        }`}
      >
        {bIsBetter ? 'B Favorable' : 'A Favorable'}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-0.5">
      {/* Top Controls: Mode Switcher, Presets & Scenario Pickers */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <GitCompareArrows className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white">
                Compare Sites &amp; Launch Windows
              </h2>
              <p className="text-[11px] text-slate-400">
                Side-by-side horizon sky-plots and solar/DTE trade-off deltas
              </p>
            </div>
          </div>

          {/* Mode Toggle + Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5"
              role="group"
              aria-label="Comparison mode"
            >
              <button
                type="button"
                onClick={() => setCompareMode('sites')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  compareMode === 'sites'
                    ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Two Sites (Same Date)</span>
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('windows')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  compareMode === 'windows'
                    ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span>Two Launch Windows</span>
              </button>
            </div>

            <button
              type="button"
              onClick={applyShackletonVsCraterPreset}
              className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
            >
              Preset: Rim vs. Crater Floor (5 km)
            </button>
            <button
              type="button"
              onClick={applySolsticePreset}
              className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300"
            >
              Preset: Summer vs. Winter
            </button>
          </div>
        </div>

        {/* Scenario Selectors */}
        <div className="mt-3 grid grid-cols-1 items-center gap-2.5 lg:grid-cols-[1fr_auto_1fr]">
          {/* Scenario A */}
          <div className="rounded-lg border border-amber-500/35 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Scenario A
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {formatLunarLatLon(
                  resolvedSiteA.coordinates.latitudeDeg,
                  resolvedSiteA.coordinates.longitudeDeg,
                )}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Site
                </span>
                <select
                  value={resolvedSiteA.id}
                  onChange={(e) => {
                    if (compareMode === 'sites') {
                      setSiteAId(e.target.value);
                    } else {
                      setSharedSiteId(e.target.value);
                    }
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role === 'comparison' ? 'PSR' : 'Candidate'})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Mission Window
                </span>
                <select
                  value={resolvedSeasonIdA}
                  onChange={(e) => {
                    if (compareMode === 'sites') {
                      setSharedSeasonId(e.target.value);
                    } else {
                      setSeasonAId(e.target.value);
                    }
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white focus:border-amber-500 focus:outline-none"
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              title="Swap Scenario A and Scenario B"
              aria-label="Swap Scenario A and Scenario B"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span className="lg:hidden">Swap A ↔ B</span>
            </button>
          </div>

          {/* Scenario B */}
          <div className="rounded-lg border border-sky-500/35 bg-slate-950/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                Scenario B
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {formatLunarLatLon(
                  resolvedSiteB.coordinates.latitudeDeg,
                  resolvedSiteB.coordinates.longitudeDeg,
                )}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Site
                </span>
                <select
                  value={resolvedSiteB.id}
                  onChange={(e) => {
                    if (compareMode === 'sites') {
                      setSiteBId(e.target.value);
                    } else {
                      setSharedSiteId(e.target.value);
                    }
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white focus:border-sky-500 focus:outline-none"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role === 'comparison' ? 'PSR' : 'Candidate'})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Mission Window
                </span>
                <select
                  value={resolvedSeasonIdB}
                  onChange={(e) => {
                    if (compareMode === 'sites') {
                      setSharedSeasonId(e.target.value);
                    } else {
                      setSeasonBId(e.target.value);
                    }
                  }}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white focus:border-sky-500 focus:outline-none"
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Synchronized Timeline & Zoom Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40 transition hover:bg-amber-500/30"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Play Sync</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => stepBy(-24)}
                className="rounded-md border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 hover:border-slate-700 hover:text-white"
                title="Back 24 hours"
                aria-label="Back 24 hours"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => stepBy(-1)}
                className="rounded-md border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 hover:border-slate-700 hover:text-white"
                title="Back 1 hour"
                aria-label="Back 1 hour"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => stepBy(1)}
                className="rounded-md border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 hover:border-slate-700 hover:text-white"
                title="Forward 1 hour"
                aria-label="Forward 1 hour"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => stepBy(24)}
                className="rounded-md border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 hover:border-slate-700 hover:text-white"
                title="Forward 24 hours"
                aria-label="Forward 24 hours"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onChangeHour(0)}
                className="rounded-md border border-slate-800 bg-slate-950/70 p-1.5 text-slate-400 hover:border-slate-700 hover:text-white"
                title="Reset to Hour 0"
                aria-label="Reset to Hour 0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/70 p-0.5 text-[11px]">
              {([1, 2, 4] as PlaybackSpeed[]).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onChangeSpeed(spd)}
                  className={`rounded px-2 py-0.5 font-mono font-medium transition ${
                    playbackSpeed === spd
                      ? 'bg-slate-800 text-amber-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-[11px] text-slate-300">
              Sync Step: <strong className="text-white">Day {dayNumber}/{totalDays}</strong> ·{' '}
              Hour {safeHourIndex + 1}/{maxHours}
            </span>

            <button
              type="button"
              onClick={() => setZoomMode((z) => (z === 'wide' ? 'horizon' : 'wide'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
            >
              {zoomMode === 'wide' ? (
                <>
                  <ZoomIn className="h-3.5 w-3.5 text-amber-400" />
                  <span>Sync Zoom: Horizon (-10°..+15°)</span>
                </>
              ) : (
                <>
                  <ZoomOut className="h-3.5 w-3.5 text-sky-400" />
                  <span>Sync Zoom: Wide (-10°..+40°)</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={safeHourIndex}
            onChange={(e) => onChangeHour(Number(e.target.value))}
            aria-label="Synchronized mission timeline scrubber"
            className="h-1.5 w-full cursor-pointer accent-amber-400"
          />
        </div>
      </div>

      {/* Synchronized Horizon Sky-Plots */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Scenario A Sky-Plot */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-slate-900/70 px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                  A
                </span>
                <span className="text-xs font-bold text-white">{resolvedSiteA.name}</span>
                <span className="text-[11px] text-slate-400">· {resolvedSeasonA?.name}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                {timeA.dateLabel} · {timeA.timeLabel} · Elev{' '}
                {resolvedSiteA.coordinates.elevationM >= 0 ? '+' : ''}
                {resolvedSiteA.coordinates.elevationM.toFixed(0)} m
              </div>
            </div>
            {currentA && (
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                    currentA.sunVisible
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Sun className="h-3 w-3" />
                  {currentA.sunVisible ? 'Sunlit' : 'Shadow'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                    currentA.earthVisible
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  <Radio className="h-3 w-3" />
                  {currentA.earthVisible ? 'DTE Up' : 'No DTE'}
                </span>
              </div>
            )}
          </div>

          <PolarHorizonSkyPlot
            site={resolvedSiteA}
            hourly={dataA.hourly}
            hourIndex={safeHourIndex}
            viewMode="planner"
            zoomMode={zoomMode}
            onToggleZoom={() => setZoomMode((z) => (z === 'wide' ? 'horizon' : 'wide'))}
            subtitle={`${resolvedSiteA.name} · ${resolvedSeasonA?.name ?? ''}`}
          />
        </div>

        {/* Scenario B Sky-Plot */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-500/30 bg-slate-900/70 px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                  B
                </span>
                <span className="text-xs font-bold text-white">{resolvedSiteB.name}</span>
                <span className="text-[11px] text-slate-400">· {resolvedSeasonB?.name}</span>
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                {timeB.dateLabel} · {timeB.timeLabel} · Elev{' '}
                {resolvedSiteB.coordinates.elevationM >= 0 ? '+' : ''}
                {resolvedSiteB.coordinates.elevationM.toFixed(0)} m
              </div>
            </div>
            {currentB && (
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                    currentB.sunVisible
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Sun className="h-3 w-3" />
                  {currentB.sunVisible ? 'Sunlit' : 'Shadow'}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-semibold ${
                    currentB.earthVisible
                      ? 'bg-sky-500/15 text-sky-300'
                      : 'bg-rose-500/15 text-rose-300'
                  }`}
                >
                  <Radio className="h-3 w-3" />
                  {currentB.earthVisible ? 'DTE Up' : 'No DTE'}
                </span>
              </div>
            )}
          </div>

          <PolarHorizonSkyPlot
            site={resolvedSiteB}
            hourly={dataB.hourly}
            hourIndex={safeHourIndex}
            viewMode="planner"
            zoomMode={zoomMode}
            onToggleZoom={() => setZoomMode((z) => (z === 'wide' ? 'horizon' : 'wide'))}
            subtitle={`${resolvedSiteB.name} · ${resolvedSeasonB?.name ?? ''}`}
          />
        </div>
      </div>

      {/* Delta Comparison Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              30-Day Mission Delta Comparison Table
            </h3>
            <p className="text-[11px] text-slate-400">
              Highlights differences in total sunlit hours, max shadow duration, and Direct-to-Earth
              (DTE) comms uptime
            </p>
          </div>
          {resolvedSiteA.id !== resolvedSiteB.id &&
            resolvedSiteB.comparisonTargetId === resolvedSiteA.id &&
            resolvedSiteB.comparisonDistanceKm != null && (
              <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-mono text-[11px] text-sky-300">
                Separation: {resolvedSiteB.comparisonDistanceKm.toFixed(2)} km
              </span>
            )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-2.5 pr-4 font-semibold">Metric</th>
                <th className="py-2.5 px-3 font-semibold text-amber-300">
                  Scenario A · {resolvedSiteA.name}
                  <span className="block font-normal normal-case text-slate-400">
                    {resolvedSeasonA?.name}
                  </span>
                </th>
                <th className="py-2.5 px-3 font-semibold text-sky-300">
                  Scenario B · {resolvedSiteB.name}
                  <span className="block font-normal normal-case text-slate-400">
                    {resolvedSeasonB?.name}
                  </span>
                </th>
                <th className="py-2.5 pl-3 font-semibold text-slate-200">
                  Delta (B − A)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {/* 1. Total Sunlit Hours (Highlighted) */}
              <tr className="bg-amber-500/[0.04]">
                <td className="py-3 pr-4 font-sans">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Sun className="h-4 w-4 text-amber-400" />
                    <span>Total Sunlit Hours</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Solar power availability (% of {maxHours}h)
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-100">
                  <div className="text-sm font-bold">{dataA.kpis.sunVisibleHours} h</div>
                  <div className="text-[11px] text-slate-400">
                    {dataA.kpis.solarPowerAvailabilityPct.toFixed(1)}%
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-100">
                  <div className="text-sm font-bold">{dataB.kpis.sunVisibleHours} h</div>
                  <div className="text-[11px] text-slate-400">
                    {dataB.kpis.solarPowerAvailabilityPct.toFixed(1)}%
                  </div>
                </td>
                <td className="py-3 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {formatDeltaNumber(deltaSunlitHours, ' h', 0)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({formatDeltaNumber(deltaSolarPct, '%', 1)})
                    </span>
                    {renderFavorBadge(deltaSunlitHours, true)}
                  </div>
                </td>
              </tr>

              {/* 2. Max Shadow Duration (Highlighted) */}
              <tr className="bg-slate-800/25">
                <td className="py-3 pr-4 font-sans">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Moon className="h-4 w-4 text-indigo-400" />
                    <span>Max Shadow Duration</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Longest continuous darkness (lower is better)
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-100">
                  <div className="text-sm font-bold">{shadowA.maxShadowHours} h</div>
                  <div className="text-[11px] text-slate-400">
                    {shadowA.shadowWindowCount} shadow{' '}
                    {shadowA.shadowWindowCount === 1 ? 'period' : 'periods'}
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-100">
                  <div className="text-sm font-bold">{shadowB.maxShadowHours} h</div>
                  <div className="text-[11px] text-slate-400">
                    {shadowB.shadowWindowCount} shadow{' '}
                    {shadowB.shadowWindowCount === 1 ? 'period' : 'periods'}
                  </div>
                </td>
                <td className="py-3 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {formatDeltaNumber(deltaMaxShadow, ' h', 0)}
                    </span>
                    {renderFavorBadge(deltaMaxShadow, false)}
                  </div>
                </td>
              </tr>

              {/* 3. DTE Comms Uptime (Highlighted) */}
              <tr className="bg-sky-500/[0.04]">
                <td className="py-3 pr-4 font-sans">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <Radio className="h-4 w-4 text-sky-400" />
                    <span>DTE Comms Uptime</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Direct-to-Earth line-of-sight visibility
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-100">
                  <div className="text-sm font-bold">
                    {dataA.kpis.dteCommsUptimePct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {dataA.kpis.earthVisibleHours} h · {dteA.windowCount} windows
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-100">
                  <div className="text-sm font-bold">
                    {dataB.kpis.dteCommsUptimePct.toFixed(1)}%
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {dataB.kpis.earthVisibleHours} h · {dteB.windowCount} windows
                  </div>
                </td>
                <td className="py-3 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {formatDeltaNumber(deltaDtePct, '%', 1)}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({formatDeltaNumber(deltaDteHours, ' h', 0)})
                    </span>
                    {renderFavorBadge(deltaDtePct, true)}
                  </div>
                </td>
              </tr>

              {/* Secondary Context Rows */}
              <tr>
                <td className="py-2.5 pr-4 font-sans text-slate-300">
                  Max Continuous Sunlight
                </td>
                <td className="py-2.5 px-3 text-slate-200">
                  {dataA.kpis.continuousSunlightHours} h
                </td>
                <td className="py-2.5 px-3 text-slate-200">
                  {dataB.kpis.continuousSunlightHours} h
                </td>
                <td className="py-2.5 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-200">
                      {formatDeltaNumber(deltaContinuousSun, ' h', 0)}
                    </span>
                    {renderFavorBadge(deltaContinuousSun, true)}
                  </div>
                </td>
              </tr>

              <tr>
                <td className="py-2.5 pr-4 font-sans text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Mountain className="h-3.5 w-3.5 text-slate-500" />
                    LOLA Elevation
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-200">
                  {resolvedSiteA.coordinates.elevationM >= 0 ? '+' : ''}
                  {resolvedSiteA.coordinates.elevationM.toFixed(1)} m
                </td>
                <td className="py-2.5 px-3 text-slate-200">
                  {resolvedSiteB.coordinates.elevationM >= 0 ? '+' : ''}
                  {resolvedSiteB.coordinates.elevationM.toFixed(1)} m
                </td>
                <td className="py-2.5 pl-3 text-slate-300">
                  {formatDeltaNumber(deltaElevationM, ' m', 1)}
                </td>
              </tr>

              <tr>
                <td className="py-2.5 pr-4 font-sans text-slate-300">
                  Sun Elevation Range
                </td>
                <td className="py-2.5 px-3 text-slate-200">
                  {formatSignedDeg(dataA.kpis.minSunElevationDeg, 1)} to{' '}
                  {formatSignedDeg(dataA.kpis.maxSunElevationDeg, 1)}
                </td>
                <td className="py-2.5 px-3 text-slate-200">
                  {formatSignedDeg(dataB.kpis.minSunElevationDeg, 1)} to{' '}
                  {formatSignedDeg(dataB.kpis.maxSunElevationDeg, 1)}
                </td>
                <td className="py-2.5 pl-3 text-slate-400">
                  Peak {formatDeltaNumber(dataB.kpis.maxSunElevationDeg - dataA.kpis.maxSunElevationDeg, '°', 1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
