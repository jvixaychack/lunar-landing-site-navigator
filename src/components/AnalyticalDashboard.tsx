import { useEffect, useState } from 'react';
import { Compass, MapPin, Mountain } from 'lucide-react';
import type {
  LunarSite,
  SeasonMetadata,
  ViewMode,
} from '../types/lunar';
import { useSiteSeason } from '../hooks/useSiteSeason';
import { formatLunarLatLon } from '../utils/lunarProjection';
import { ExplorerCallouts } from './ExplorerCallouts';
import { KpiCards } from './KpiCards';
import { PolarHorizonSkyPlot } from './PolarHorizonSkyPlot';
import { TimelineScrubber, type PlaybackSpeed } from './TimelineScrubber';

interface AnalyticalDashboardProps {
  site: LunarSite | null;
  seasons: SeasonMetadata[];
  selectedSeasonId: string;
  onSelectSeason: (seasonId: string) => void;
  hourIndex: number;
  onChangeHour: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: PlaybackSpeed;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
  viewMode: ViewMode;
}

export function AnalyticalDashboard({
  site,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  hourIndex,
  onChangeHour,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  viewMode,
}: AnalyticalDashboardProps) {
  const [startDate, setStartDate] = useState(
    () => seasons.find((season) => season.id === selectedSeasonId)?.timeRange.start.slice(0, 10) ?? '',
  );
  const season = seasons.find((item) => item.id === selectedSeasonId);
  const seasonResult = useSiteSeason(site ?? undefined, selectedSeasonId, startDate, seasons);

  useEffect(() => {
    if (season) setStartDate(season.timeRange.start.slice(0, 10));
  }, [season]);

  if (!site) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        <Compass className="h-8 w-8 text-slate-600" />
        <h2 className="mt-3 text-sm font-semibold text-slate-200">
          Select a Lunar South Pole Site
        </h2>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Click any Artemis IV study or comparison site from the list or Lunaserv map to inspect
          its 360° horizon sky plot, geometric sunlight availability, and Earth line-of-sight
          windows.
        </p>
      </div>
    );
  }

  const seasonData = seasonResult.data;

  if (!seasonData) {
    if (seasonResult.loading) {
      return (
        <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-xs text-slate-400" role="status">
          Calculating 30-day ephemeris for {startDate || 'selected date'}…
        </div>
      );
    }
    if (seasonResult.error) {
      return (
        <div className="flex h-full items-center justify-center rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-xs text-rose-200" role="alert">
          {seasonResult.error}
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-xs text-slate-400">
        No ephemeris data available for {site.name}.
      </div>
    );
  }

  const isComparison = site.role === 'comparison';
  const safeHourIndex = Math.min(
    Math.max(0, hourIndex),
    Math.max(0, seasonData.hourly.length - 1),
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-0.5">
      {/* Site Summary Header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin
              className={`h-4 w-4 shrink-0 ${
                isComparison ? 'text-sky-400' : 'text-amber-400'
              }`}
            />
            <h2 className="text-sm font-bold text-white">{site.name}</h2>
          </div>

          <span
            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isComparison
                ? 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30'
                : 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
            }`}
          >
            {isComparison ? 'Comparison Point' : 'Study Site'}
          </span>
        </div>

        <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
          {site.description}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-slate-400">
          <span>
            {formatLunarLatLon(
              site.coordinates.latitudeDeg,
              site.coordinates.longitudeDeg,
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <Mountain className="h-3.5 w-3.5 text-slate-500" />
            {site.coordinates.elevationM >= 0 ? '+' : ''}
            {site.coordinates.elevationM.toFixed(1)} m
          </span>
          {site.comparisonDistanceKm != null && (
            <span className="text-sky-300">
              {site.comparisonDistanceKm.toFixed(2)} km from Shackleton Rim
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <KpiCards
        kpis={seasonData.kpis}
        hourly={seasonData.hourly}
        hourIndex={safeHourIndex}
        viewMode={viewMode}
      />

      {/* 360° Polar Horizon Sky-Plot */}
      <PolarHorizonSkyPlot
        site={site}
        hourly={seasonData.hourly}
        hourIndex={safeHourIndex}
        viewMode={viewMode}
      />

      {/* 30-Day Scrubbable Timeline */}
      <TimelineScrubber
        hourly={seasonData.hourly}
        hourIndex={safeHourIndex}
        onChangeHour={onChangeHour}
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={onChangeSpeed}
        seasons={seasons}
        selectedSeasonId={selectedSeasonId}
        onSelectSeason={onSelectSeason}
        startDate={startDate}
        onChangeStartDate={(date) => {
          setStartDate(date);
          onChangeHour(0);
        }}
        dataSource={seasonResult.source}
        isLoading={seasonResult.loading}
      />

      {/* Explorer (Educator) Mode Callouts */}
      {viewMode === 'explorer' && (
        <ExplorerCallouts site={site} kpis={seasonData.kpis} />
      )}
    </div>
  );
}
