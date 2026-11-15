import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Star,
  Sun,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { LunarSite, SeasonMetadata, SiteSeasonData } from '../types/lunar';
import { useSiteSeason } from '../hooks/useSiteSeason';
import {
  computeEarthVisibilitySummary,
  computeShadowSummary,
  formatUtcTimestamp,
  type EarthVisibilitySummary,
  type ShadowSummary,
} from '../utils/lunarAnalytics';
import { assessViability, RATING_LABEL, type Rating } from '../utils/viability';
import { DatePickerInput } from './DatePickerInput';
import { PolarHorizonSkyPlot, type ZoomMode } from './PolarHorizonSkyPlot';
import { RATING_STYLE } from './ViabilityCard';
import type { PlaybackSpeed } from './TimelineScrubber';

interface MultiCompareViewProps {
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

interface Scenario {
  key: number;
  siteId: string;
  startDate: string;
}

const MIN_SCENARIOS = 2;
const MAX_SCENARIOS = 4;

// Tailwind needs complete class names, so each colour set is spelled out.
const STYLES = [
  { letter: 'A', badge: 'text-slate-100', border: 'border-slate-500', bar: 'bg-slate-200' },
  { letter: 'B', badge: 'text-violet-300', border: 'border-violet-400/50', bar: 'bg-violet-300' },
  { letter: 'C', badge: 'text-teal-300', border: 'border-teal-400/50', bar: 'bg-teal-300' },
  { letter: 'D', badge: 'bg-violet-500/15 text-violet-300', border: 'border-violet-500/30', bar: 'bg-violet-400' },
] as const;

interface Column {
  scenario: Scenario;
  site: LunarSite | undefined;
  data: SiteSeasonData | undefined;
  shadow: ShadowSummary | null;
  earth: EarthVisibilitySummary | null;
  source: string | undefined;
  loading: boolean;
  error: string | null;
}

interface MetricRow {
  label: string;
  hint?: string;
  /** Raw numbers used to find the best scenario. null while a scenario is still loading. */
  values: (number | null)[];
  text: (index: number) => string;
  /** true: bigger is better, false: smaller is better, null: informational only. */
  higherIsBetter: boolean | null;
  barPct?: (index: number) => number;
  /** When set, the cell text is coloured as a Good / Marginal / Poor rating. */
  rating?: (index: number) => Rating;
}

/** Indexes holding the best value, or an empty set when there is nothing meaningful to highlight. */
function bestIndexes(values: (number | null)[], higherIsBetter: boolean | null): Set<number> {
  if (higherIsBetter === null) return new Set();
  const present = values
    .map((value, index) => ({ value, index }))
    .filter((item): item is { value: number; index: number } => item.value !== null);
  if (present.length < 2) return new Set();
  const nums = present.map((item) => item.value);
  const target = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  const winners = present.filter((item) => Math.abs(item.value - target) < 0.005);
  return winners.length === present.length ? new Set() : new Set(winners.map((item) => item.index));
}

function startDateOf(season: SeasonMetadata | undefined): string {
  return season?.timeRange.start.slice(0, 10) ?? '';
}

export function MultiCompareView({
  sites,
  seasons,
  defaultSeasonId,
  hourIndex,
  onChangeHour,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
}: MultiCompareViewProps) {
  const defaultStart =
    startDateOf(seasons.find((s) => s.id === defaultSeasonId)) || startDateOf(seasons[0]);

  const nextKey = useRef(1);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('wide');

  // Seed three scenarios once the site list has loaded.
  useEffect(() => {
    if (scenarios.length > 0 || sites.length === 0 || !defaultStart) return;
    const preferred = ['shackleton-rim', 'malapert-massif', 'deep-crater-floor']
      .map((id) => sites.find((s) => s.id === id))
      .filter((s): s is LunarSite => Boolean(s));
    const chosen = [...preferred];
    for (const site of sites) {
      if (chosen.length >= 3) break;
      if (!chosen.includes(site)) chosen.push(site);
    }
    setScenarios(
      chosen.slice(0, 3).map((site) => ({ key: nextKey.current++, siteId: site.id, startDate: defaultStart })),
    );
  }, [scenarios.length, sites, defaultStart]);

  const seasonIdFor = (scenario: Scenario | undefined) =>
    seasons.find((s) => startDateOf(s) === scenario?.startDate)?.id ?? defaultSeasonId;
  const siteFor = (scenario: Scenario | undefined) => sites.find((s) => s.id === scenario?.siteId);

  // A fixed number of hook calls (React forbids a variable number). Unused slots get no site and do nothing.
  const s0 = scenarios[0];
  const s1 = scenarios[1];
  const s2 = scenarios[2];
  const s3 = scenarios[3];
  const r0 = useSiteSeason(siteFor(s0), seasonIdFor(s0), s0?.startDate ?? '', seasons);
  const r1 = useSiteSeason(siteFor(s1), seasonIdFor(s1), s1?.startDate ?? '', seasons);
  const r2 = useSiteSeason(siteFor(s2), seasonIdFor(s2), s2?.startDate ?? '', seasons);
  const r3 = useSiteSeason(siteFor(s3), seasonIdFor(s3), s3?.startDate ?? '', seasons);
  const results = [r0, r1, r2, r3];

  const summaries = useMemo(
    () =>
      [r0.data, r1.data, r2.data, r3.data].map((data) => ({
        shadow: data ? computeShadowSummary(data.hourly) : null,
        earth: data ? computeEarthVisibilitySummary(data.hourly) : null,
      })),
    [r0.data, r1.data, r2.data, r3.data],
  );

  const viabilities = useMemo(
    () => [r0.data, r1.data, r2.data, r3.data].map((data) => (data ? assessViability(data.hourly) : null)),
    [r0.data, r1.data, r2.data, r3.data],
  );

  const columns: Column[] = scenarios.map((scenario, i) => ({
    scenario,
    site: siteFor(scenario),
    data: results[i].data,
    shadow: summaries[i].shadow,
    earth: summaries[i].earth,
    source: results[i].source,
    loading: results[i].loading,
    error: results[i].error,
  }));

  const loadedHours = columns.map((c) => c.data?.hourly.length).filter((n): n is number => typeof n === 'number');
  const maxHours = loadedHours.length > 0 ? Math.min(...loadedHours) : 720;
  const maxIndex = Math.max(0, maxHours - 1);
  const safeHourIndex = Math.min(Math.max(0, hourIndex), maxIndex);
  const dayNumber = Math.floor(safeHourIndex / 24) + 1;
  const totalDays = Math.max(1, Math.round(maxHours / 24));

  const updateScenario = (key: number, patch: Partial<Omit<Scenario, 'key'>>) => {
    setScenarios((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    if (patch.startDate !== undefined) onChangeHour(0);
  };
  const removeScenario = (key: number) => {
    setScenarios((prev) => (prev.length > MIN_SCENARIOS ? prev.filter((s) => s.key !== key) : prev));
  };
  const addScenario = () => {
    setScenarios((prev) => {
      if (prev.length >= MAX_SCENARIOS) return prev;
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          key: nextKey.current++,
          siteId: last?.siteId ?? sites[0]?.id ?? '',
          startDate: last?.startDate ?? defaultStart,
        },
      ];
    });
  };

  const presetSitesAtOneDate = () => {
    const date = scenarios[0]?.startDate || defaultStart;
    setScenarios(
      sites.slice(0, MAX_SCENARIOS).map((site) => ({ key: nextKey.current++, siteId: site.id, startDate: date })),
    );
    onChangeHour(0);
  };
  const presetOneSiteAllSeasons = () => {
    const siteId = scenarios[0]?.siteId || sites[0]?.id || '';
    const picks = seasons.slice(0, MAX_SCENARIOS);
    if (!siteId || picks.length < MIN_SCENARIOS) return;
    setScenarios(picks.map((season) => ({ key: nextKey.current++, siteId, startDate: startDateOf(season) })));
    onChangeHour(0);
  };

  const columnLabel = (index: number) => {
    const column = columns[index];
    const date = column?.scenario.startDate;
    const seasonName = seasons.find((s) => startDateOf(s) === date)?.name;
    return `${column?.site?.name ?? 'Unknown site'} · ${seasonName ?? (date ? `from ${date}` : 'no date')}`;
  };

  const ready =
    columns.length > 0 &&
    columns.every((c, i) => c.data && c.shadow && c.earth && c.site && viabilities[i]);

  const rows: MetricRow[] = ready
    ? [
        {
          label: 'Overall viability',
          hint: 'The weaker of the power and comms ratings. A simple screening, not a mission requirement.',
          values: columns.map(() => null),
          text: (i) => RATING_LABEL[viabilities[i]!.overall],
          higherIsBetter: null,
          rating: (i) => viabilities[i]!.overall,
        },
        {
          label: 'Solar power',
          values: columns.map(() => null),
          text: (i) => RATING_LABEL[viabilities[i]!.power.rating],
          higherIsBetter: null,
          rating: (i) => viabilities[i]!.power.rating,
        },
        {
          label: 'Earth comms',
          values: columns.map(() => null),
          text: (i) => RATING_LABEL[viabilities[i]!.comms.rating],
          higherIsBetter: null,
          rating: (i) => viabilities[i]!.comms.rating,
        },
        {
          label: 'Sunlight availability',
          hint: 'Share of the 30 days with the Sun above the terrain horizon',
          values: columns.map((c) => c.data!.kpis.sunlightAvailabilityPct),
          text: (i) => `${columns[i].data!.kpis.sunlightAvailabilityPct.toFixed(1)}% (${columns[i].data!.kpis.sunVisibleHours} h)`,
          higherIsBetter: true,
          barPct: (i) => columns[i].data!.kpis.sunlightAvailabilityPct,
        },
        {
          label: 'Longest continuous sunlight',
          values: columns.map((c) => c.data!.kpis.continuousSunlightHours),
          text: (i) => `${columns[i].data!.kpis.continuousSunlightHours} h`,
          higherIsBetter: true,
        },
        {
          label: 'Longest continuous shadow',
          hint: 'Lower is better: a lander must survive the dark with stored energy',
          values: columns.map((c) => c.shadow!.maxShadowHours),
          text: (i) => `${columns[i].shadow!.maxShadowHours} h`,
          higherIsBetter: false,
        },
        {
          label: 'Earth line of sight',
          hint: 'Share of the 30 days with Earth above the terrain horizon (direct-to-Earth comms)',
          values: columns.map((c) => c.data!.kpis.earthLineOfSightPct),
          text: (i) => `${columns[i].data!.kpis.earthLineOfSightPct.toFixed(1)}% (${columns[i].data!.kpis.earthVisibleHours} h)`,
          higherIsBetter: true,
          barPct: (i) => columns[i].data!.kpis.earthLineOfSightPct,
        },
        {
          label: 'Longest Earth window',
          values: columns.map((c) => c.earth!.longestWindowHours),
          text: (i) => `${columns[i].earth!.longestWindowHours} h (${columns[i].earth!.windowCount} windows)`,
          higherIsBetter: true,
        },
        {
          label: 'Sun elevation range',
          values: columns.map(() => null),
          text: (i) =>
            `${columns[i].data!.kpis.minSunElevationDeg.toFixed(1)}° to ${columns[i].data!.kpis.maxSunElevationDeg.toFixed(1)}°`,
          higherIsBetter: null,
        },
        {
          label: 'Site elevation',
          values: columns.map(() => null),
          text: (i) => {
            const m = columns[i].site!.coordinates.elevationM;
            return `${m >= 0 ? '+' : ''}${m.toFixed(0)} m`;
          },
          higherIsBetter: null,
        },
      ]
    : [];

  const statusMessage = (() => {
    const failed = columns.find((c) => c.error);
    if (failed) return failed.error;
    if (columns.some((c) => c.loading)) return 'Calculating 30-day ephemerides…';
    return null;
  })();

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-0.5">
      {/* Scenario setup */}
      <div className="rounded-md border border-slate-800 bg-slate-900 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div>
              <h2 className="font-mono text-2xl font-semibold leading-tight text-slate-50">Compare scenarios</h2>
              <p className="text-xs text-slate-400">
                Up to {MAX_SCENARIOS} scenarios, each with its own site and start date.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={presetSitesAtOneDate}
              className="rounded-lg border border-slate-700/80 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-400 hover:text-white"
            >
              Preset: sites at one date
            </button>
            <button
              type="button"
              onClick={presetOneSiteAllSeasons}
              className="rounded-lg border border-slate-700/80 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-400 hover:text-white"
            >
              Preset: one site, all seasons
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {scenarios.map((scenario, index) => {
            const style = STYLES[index];
            return (
              <div key={scenario.key} className={`rounded-lg border ${style.border} bg-slate-950/60 p-2.5`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={`rounded-sm border px-1.5 py-0.5 text-xs font-semibold ${style.border} ${style.badge}`}>
                    Scenario {style.letter}
                  </span>
                  {scenarios.length > MIN_SCENARIOS && (
                    <button
                      type="button"
                      onClick={() => removeScenario(scenario.key)}
                      className="text-slate-500 transition hover:text-rose-300"
                      aria-label={`Remove scenario ${style.letter}`}
                      title={`Remove scenario ${style.letter}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <label className="block text-[11px] text-slate-500">
                  Site
                  <select
                    value={scenario.siteId}
                    onChange={(e) => updateScenario(scenario.key, { siteId: e.target.value })}
                    className="mt-0.5 w-full rounded-md border border-slate-700/80 bg-slate-950 px-2 py-1 text-xs normal-case text-slate-100"
                    aria-label={`Scenario ${style.letter} site`}
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                        {site.role === 'comparison' ? ' (Comparison)' : site.role === 'custom' ? ' (Custom)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-1.5 block text-[11px] text-slate-500">
                  30-day window start (UTC)
                  <DatePickerInput
                    value={scenario.startDate}
                    onChange={(value) => updateScenario(scenario.key, { startDate: value })}
                    ariaLabel={`Scenario ${style.letter} window start date`}
                    className="mt-0.5 w-full rounded-md border border-slate-700/80 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  />
                </label>
              </div>
            );
          })}

          {scenarios.length < MAX_SCENARIOS && scenarios.length > 0 && (
            <button
              type="button"
              onClick={addScenario}
              className="flex min-h-[110px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-700 text-xs font-medium text-slate-400 transition hover:border-slate-400 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add scenario (copies the last one)
            </button>
          )}
        </div>
      </div>

      {/* Shared timeline */}
      <div className="rounded-md border border-slate-800 bg-slate-900 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-white"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? 'Pause' : 'Play Sync'}
            </button>
            <button
              type="button"
              onClick={() => onChangeHour(0)}
              className="rounded-md border border-slate-800 bg-slate-950 p-1.5 text-slate-400 hover:border-slate-700 hover:text-white"
              title="Reset to Hour 0"
              aria-label="Reset to Hour 0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              {([1, 2, 4] as PlaybackSpeed[]).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => onChangeSpeed(speed)}
                  className={`rounded font-mono font-medium transition ${
                    playbackSpeed === speed ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-mono text-xs text-slate-300">
              Day <strong className="text-white">{dayNumber}/{totalDays}</strong> · Hour {safeHourIndex + 1}/{maxHours}
            </span>
            <button
              type="button"
              onClick={() => setZoomMode((z) => (z === 'wide' ? 'horizon' : 'wide'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-400 hover:text-white"
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
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={safeHourIndex}
          onChange={(e) => onChangeHour(Number(e.target.value))}
          aria-label="Synchronized timeline for all scenarios"
          className="mt-2.5 h-1.5 w-full cursor-pointer accent-slate-200"
        />
        <p className="mt-1 text-[11px] text-slate-500" aria-live="polite">
          {columns.map((c, i) => `${STYLES[i].letter}: ${c.source ?? 'pending'}`).join(' · ')}
        </p>
      </div>

      {statusMessage && (
        <div
          role={columns.some((c) => c.error) ? 'alert' : 'status'}
          className={`rounded-md border p-3 text-xs ${
            columns.some((c) => c.error)
              ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
              : 'border-slate-800 bg-slate-900 text-slate-400'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Comparison table */}
      {ready && (
        <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            30-Day Scenario Comparison
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            The star marks the best value in each row. Rows with no star are informational, or all scenarios tie.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-xs">
              <thead>
                <tr>
                  <th className="w-40 border-b border-slate-800 pb-2 pr-3 font-medium text-slate-500">Metric</th>
                  {columns.map((c, i) => (
                    <th key={c.scenario.key} className="border-b border-slate-800 pb-2 pr-3 align-bottom">
                      <span className={`mr-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-semibold ${STYLES[i].border} ${STYLES[i].badge}`}>
                        {STYLES[i].letter}
                      </span>
                      <span className="text-xs font-semibold text-white">{columnLabel(i)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const best = bestIndexes(row.values, row.higherIsBetter);
                  return (
                    <tr key={row.label}>
                      <th
                        scope="row"
                        className="border-b border-slate-800/70 py-2 pr-3 align-top font-medium text-slate-300"
                        title={row.hint}
                      >
                        {row.label}
                      </th>
                      {columns.map((c, i) => (
                        <td key={c.scenario.key} className="border-b border-slate-800/70 py-2 pr-3 align-top">
                          <div
                            className={`font-mono text-[12px] ${
                              row.rating
                                ? `font-semibold ${RATING_STYLE[row.rating(i)].text}`
                                : best.has(i)
                                  ? 'font-semibold text-slate-50'
                                  : 'text-slate-200'
                            }`}
                          >
                            {best.has(i) && (
                              <Star
                                className="mr-1 inline h-3 w-3 fill-slate-100 text-slate-100"
                                aria-label="Best in this row"
                              />
                            )}
                            {row.text(i)}
                          </div>
                          {row.barPct && (
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-slate-800">
                              <div
                                className={`h-full ${STYLES[i].bar}`}
                                style={{ width: `${Math.min(100, Math.max(0, row.barPct(i)))}%` }}
                              />
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Synchronized sky plots */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {columns.map((c, i) => {
          const current = c.data?.hourly[safeHourIndex] ?? c.data?.hourly[0];
          const time = current ? formatUtcTimestamp(current.timestamp) : null;
          return (
            <div key={c.scenario.key} className="flex flex-col gap-2">
              <div
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border ${STYLES[i].border} bg-slate-900 px-3.5 py-2.5`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-sm border px-1.5 py-0.5 text-xs font-semibold ${STYLES[i].border} ${STYLES[i].badge}`}>
                      {STYLES[i].letter}
                    </span>
                    <span className="text-xs font-bold text-white">{columnLabel(i)}</span>
                  </div>
                  {time && (
                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                      {time.dateLabel} · {time.timeLabel}
                    </div>
                  )}
                </div>
                {current && (
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded font-semibold ${
                        current.sunVisible ? 'text-amber-300' : 'text-slate-400'
                      }`}
                    >
                      <Sun className="h-3 w-3" />
                      {current.sunVisible ? 'Sunlit' : 'Shadow'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded font-semibold ${
                        current.earthVisible ? 'text-sky-300' : 'text-rose-300'
                      }`}
                    >
                      <Radio className="h-3 w-3" />
                      {current.earthVisible ? 'Earth Visible' : 'Earth Blocked'}
                    </span>
                  </div>
                )}
              </div>
              {c.site && c.data ? (
                <PolarHorizonSkyPlot
                  site={c.site}
                  hourly={c.data.hourly}
                  hourIndex={safeHourIndex}
                  viewMode="planner"
                  zoomMode={zoomMode}
                  onToggleZoom={() => setZoomMode((z) => (z === 'wide' ? 'horizon' : 'wide'))}
                  subtitle={columnLabel(i)}
                />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-xs text-slate-400">
                  {c.loading ? 'Calculating…' : (c.error ?? 'Waiting for data…')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
