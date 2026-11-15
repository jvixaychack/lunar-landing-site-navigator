import { useCallback, useEffect, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Compass,
  GitCompareArrows,
  Globe2,
  MapPin,
  Mountain,
  Radio,
  Sun,
} from 'lucide-react';
import { AnalyticalDashboard } from './components/AnalyticalDashboard';
import { CompareView } from './components/CompareView';
import { DataCitationsModal } from './components/DataCitationsModal';
import { LunarSouthPoleMap } from './components/LunarSouthPoleMap';
import type { PlaybackSpeed } from './components/TimelineScrubber';
import type { LunarSite, SitesDataset, ViewMode } from './types/lunar';
import { formatLunarLatLon } from './utils/lunarProjection';

export function App() {
  const [dataset, setDataset] = useState<SitesDataset | null>(null);
  const [selectedSite, setSelectedSite] = useState<LunarSite | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('equinox');
  const [hourIndex, setHourIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [viewMode, setViewMode] = useState<ViewMode>('planner');
  const [isCitationsOpen, setIsCitationsOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/sites.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load data/sites.json (${res.status})`);
        }
        return res.json() as Promise<SitesDataset>;
      })
      .then((data) => {
        if (!cancelled) {
          setDataset(data);
          if (data.metadata?.defaultSeason) {
            setSelectedSeasonId(data.metadata.defaultSeason);
          }
          if (data.sites.length > 0) {
            setSelectedSite(data.sites[0]);
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load site data');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSeasonData =
    selectedSite?.seasons?.[selectedSeasonId] ??
    (selectedSite?.seasons ? Object.values(selectedSite.seasons)[0] : undefined);
  const totalHours = activeSeasonData?.hourly.length ?? 720;

  useEffect(() => {
    if (!isPlaying || totalHours <= 1) return;

    const intervalMs = playbackSpeed === 4 ? 45 : playbackSpeed === 2 ? 90 : 180;
    const timer = window.setInterval(() => {
      setHourIndex((prev) => (prev + 1) % totalHours);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, totalHours]);

  const handleSelectSeason = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setHourIndex(0);
  };
  const handleMapSelectSite = useCallback((site: LunarSite | null) => {
    if (site) setSelectedSite(site);
  }, []);
  const sites = dataset?.sites ?? [];
  const seasons = dataset?.metadata?.seasons ?? [];

  return (
    <div className="flex min-h-screen w-screen flex-col bg-slate-950 text-slate-100 lg:h-screen lg:overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/70 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">
              Lunar South Pole Navigator
            </h1>
            <p className="text-[11px] text-slate-400">
              South Pole Stereographic (IAU2000:30120) · ASU/NASA Lunaserv WMS &amp; LOLA DEM
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Planner vs. Explorer (Educator) vs. Compare Mode Toggle */}
          <div
            className="flex items-center rounded-lg border border-slate-800 bg-slate-950/80 p-0.5"
            role="group"
            aria-label="Dashboard mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('planner')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'planner'
                  ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Planner</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('explorer')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'explorer'
                  ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Explorer (Educator)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compare')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                viewMode === 'compare'
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              <span>Compare Sites &amp; Launch Windows</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsCitationsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/80 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
          >
            <BookMarked className="h-3.5 w-3.5 text-amber-400" />
            <span>Data &amp; NASA Citations</span>
          </button>

          <span className="hidden rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-1 font-mono text-[11px] text-slate-300 sm:inline-block">
            {sites.length} Sites Loaded
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {viewMode === 'compare' ? (
          <section className="min-h-0 flex-1">
            {error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-4 text-xs text-rose-200">
                {error}
              </div>
            ) : (
              <CompareView
                sites={sites}
                seasons={seasons}
                defaultSeasonId={dataset?.metadata?.defaultSeason ?? selectedSeasonId}
                hourIndex={hourIndex}
                onChangeHour={setHourIndex}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                playbackSpeed={playbackSpeed}
                onChangeSpeed={setPlaybackSpeed}
              />
            )}
          </section>
        ) : (
          <>
            {/* Sidebar: Study & Comparison Sites */}
            <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 lg:w-64 xl:w-72">
          <div className="border-b border-slate-800 px-3.5 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Artemis IV South Pole Study Sites
            </h2>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
                {error}
              </div>
            )}

            {!error && !dataset && (
              <div className="p-3 text-xs text-slate-400">Loading sites…</div>
            )}

            {sites.map((site) => {
              const isSelected = selectedSite?.id === site.id;
              const isComparison = site.role === 'comparison';
              const siteSeason =
                site.seasons?.[selectedSeasonId] ??
                (site.seasons ? Object.values(site.seasons)[0] : undefined);

              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSelectedSite(site)}
                  className={`w-full rounded-lg border p-2.5 text-left transition ${
                    isSelected
                      ? 'border-amber-500/60 bg-amber-500/10 shadow-sm'
                      : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isComparison ? 'text-sky-400' : 'text-amber-400'
                        }`}
                      />
                      <span className="text-xs font-semibold text-white">
                        {site.name}
                      </span>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        isComparison
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {site.role}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-slate-400">
                    <span>
                      {formatLunarLatLon(
                        site.coordinates.latitudeDeg,
                        site.coordinates.longitudeDeg,
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Mountain className="h-3 w-3 text-slate-500" />
                      {site.coordinates.elevationM >= 0 ? '+' : ''}
                      {site.coordinates.elevationM.toFixed(0)} m
                    </span>
                  </div>

                  {siteSeason && (
                    <div className="mt-1.5 flex items-center gap-3 border-t border-slate-800/70 pt-1.5 font-mono text-[10px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-amber-300/90">
                        <Sun className="h-3 w-3" />
                        {siteSeason.kpis.sunlightAvailabilityPct.toFixed(0)}%
                      </span>
                      <span className="inline-flex items-center gap-1 text-sky-300/90">
                        <Radio className="h-3 w-3" />
                        {siteSeason.kpis.earthLineOfSightPct.toFixed(0)}% Earth LOS
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Map Viewport */}
        <section className="min-h-[380px] flex-1 lg:min-h-0">
      <LunarSouthPoleMap
          onSelectSite={handleMapSelectSite}
          sites={sites}
          selectedSite={selectedSite}
          />
        </section>

            {/* Analytical Dashboard beside the Lunaserv Map */}
            <section className="w-full shrink-0 lg:min-h-0 lg:w-[460px] xl:w-[530px] 2xl:w-[580px]">
              <AnalyticalDashboard
                site={selectedSite}
                seasons={seasons}
                selectedSeasonId={selectedSeasonId}
                onSelectSeason={handleSelectSeason}
                hourIndex={hourIndex}
                onChangeHour={setHourIndex}
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying((p) => !p)}
                playbackSpeed={playbackSpeed}
                onChangeSpeed={setPlaybackSpeed}
                viewMode={viewMode}
              />
            </section>
          </>
        )}
      </main>

      <DataCitationsModal
        isOpen={isCitationsOpen}
        onClose={() => setIsCitationsOpen(false)}
        metadata={dataset?.metadata}
      />
    </div>
  );
}

export default App;
