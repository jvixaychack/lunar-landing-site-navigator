import { useEffect, useState } from 'react';
import { Compass, MapPin, Mountain } from 'lucide-react';
import type {
  LunarSite,
  SeasonMetadata,
  ViewMode,
} from '../types/lunar';
import { useSiteSeason } from '../hooks/useSiteSeason';
import { formatLunarLatLon } from '../utils/lunarProjection';
import { CountdownCards } from './CountdownCards';
import { ViabilityCard } from './ViabilityCard';
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
      <div className="flex h-full flex-col items-center justify-center rounded-md border border-slate-800 bg-slate-900 p-6 text-center">
        <Compass className="h-8 w-8 text-slate-600" />
        <h2 className="mt-3 text-sm font-semibold text-slate-200">
          Select a site
        </h2>
        <p className="mt-1 max-w-xs text-xs text-slate-400">
          Choose a site from the list or the map to see its horizon, sunlight and Earth visibility over 30 days.
        </p>
      </div>
    );
  }

  const seasonData = seasonResult.data;

  if (!seasonData) {
    if (seasonResult.loading) {
      return (
        <div className="flex h-full items-center justify-center rounded-md border border-slate-800 bg-slate-900 p-6 text-xs text-slate-400" role="status">
          Calculating 30-day ephemeris for {startDate || 'selected date'}…
        </div>
      );
    }
    if (seasonResult.error) {
      return (
        <div className="flex h-full items-center justify-center rounded-md border border-rose-500/40 bg-rose-950/30 p-6 text-xs text-rose-200" role="alert">
          {seasonResult.error}
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-slate-800 bg-slate-900 p-6 text-xs text-slate-400">
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
    <div className="flex h-full flex-col gap-5 overflow-y-auto rounded-md border border-slate-800 bg-slate-900 p-4">
      {/* Site summary */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h2 className="font-mono text-3xl font-semibold leading-tight text-slate-50">{site.name}</h2>
          <span
            className={`inline-flex items-center gap-1.5 text-sm ${
              isComparison ? 'text-sky-300' : site.role === 'custom' ? 'text-slate-200' : 'text-amber-300'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            {isComparison ? 'Comparison point' : site.role === 'custom' ? 'Custom point' : 'Study site'}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-slate-300">
          <span>
            {formatLunarLatLon(
              site.coordinates.latitudeDeg,
              site.coordinates.longitudeDeg,
            )}
          </span>
          <span className="inline-flex items-center gap-1">
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

        <p className="mt-2.5 max-w-[62ch] text-sm leading-relaxed text-slate-400">
          {site.description}
        </p>
      </section>

      {/* Good / Marginal / Poor screening for this site and window */}
      <ViabilityCard hourly={seasonData.hourly} />

      {/* Time until sunset / Earthset at the selected moment */}
      <CountdownCards hourly={seasonData.hourly} hourIndex={safeHourIndex} />

      {/* KPI Cards */}
      <KpiCards
        kpis={seasonData.kpis}
        hourly={seasonData.hourly}
        hourIndex={safeHourIndex}
        viewMode={viewMode}
      />

      {/* Horizon sky plot */}
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
