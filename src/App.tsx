import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Compass,
  GitCompareArrows,
  Mountain,
  Radio,
  Sun,
} from 'lucide-react';
import { AnalyticalDashboard } from './components/AnalyticalDashboard';
import { CompareHub } from './components/CompareHub';
import { CustomSiteForm } from './components/CustomSiteForm';
import { DataCitationsModal } from './components/DataCitationsModal';
import { LunarSouthPoleMap } from './components/LunarSouthPoleMap';
import type { PlaybackSpeed } from './components/TimelineScrubber';
import type { LunarSite, SitesDataset, ViewMode } from './types/lunar';
import { buildCustomSite, createHttpTileLoader } from './utils/horizonMask';
import { formatLunarLatLon } from './utils/lunarProjection';

// One loader for the whole app so downloaded terrain tiles are cached and reused.
const demLoader = createHttpTileLoader(import.meta.env.BASE_URL);
const MAX_CUSTOM_SITES = 10;

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
  const [customSites, setCustomSites] = useState<LunarSite[]>([]);
  const [pickMode, setPickMode] = useState<boolean>(false);
  const [pickRequest, setPickRequest] = useState<{ latitudeDeg: number; longitudeDeg: number; nonce: number } | null>(null);

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
  const sites = useMemo(() => [...(dataset?.sites ?? []), ...customSites], [dataset, customSites]);

  const handleAddCustomSite = useCallback(
    async (latitudeDeg: number, longitudeDeg: number, name: string) => {
      const site = await buildCustomSite(latitudeDeg, longitudeDeg, demLoader, name);
      setCustomSites((prev) => {
        if (prev.some((s) => s.id === site.id)) return prev;
        // Keep the list manageable when clicking around: drop the oldest beyond the limit.
        return [...prev, site].slice(-MAX_CUSTOM_SITES);
      });
      setSelectedSite(site);
    },
    [],
  );

  const handleMapPickPoint = useCallback((latitudeDeg: number, longitudeDeg: number) => {
    setPickRequest({ latitudeDeg, longitudeDeg, nonce: Date.now() });
  }, []);

  const handleTogglePickMode = useCallback(() => setPickMode((on) => !on), []);

  const handleClearCustomSites = useCallback(() => {
    setCustomSites([]);
    setSelectedSite((current) => (current?.role === 'custom' ? dataset?.sites[0] ?? null : current));
  }, [dataset]);
  const seasons = dataset?.metadata?.seasons ?? [];

  return (
    <div className="flex min-h-screen w-screen flex-col bg-slate-950 text-slate-100 lg:h-screen lg:overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-slate-800 bg-slate-950 px-5 pt-3">
        <div className="flex items-center gap-3 pb-3">
          {/* Terminator mark: a Moon half in sunlight, half in shadow */}
          <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" role="img" aria-label="Lunar Navigator">
            <circle cx="12" cy="12" r="10.5" fill="none" stroke="#ddd8cb" strokeWidth="1.25" />
            <path d="M12 1.5a10.5 10.5 0 0 1 0 21z" fill="#f4c95d" />
          </svg>
          <div>
            <h1 className="font-mono text-2xl font-semibold leading-none text-slate-50">
              Lunar South Pole Navigator
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              LOLA terrain and ASU/NASA Lunaserv imagery, South Pole stereographic (IAU2000:30120)
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap items-end gap-x-5" aria-label="Dashboard mode">
          {(
            [
              ['planner', 'Planner', Compass],
              ['explorer', 'Explorer', BookOpen],
              ['compare', 'Compare sites', GitCompareArrows],
            ] as const
          ).map(([mode, label, Icon]) => {
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-slate-100 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-4 pb-3 text-sm">
          <button
            type="button"
            onClick={() => setIsCitationsOpen(true)}
            className="inline-flex items-center gap-1.5 text-slate-300 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-white hover:decoration-slate-300"
          >
            <BookMarked className="h-3.5 w-3.5" />
            <span>Data and citations</span>
          </button>
          <span className="hidden font-mono text-slate-400 sm:inline-block">{sites.length} sites</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row">
        {viewMode === 'compare' ? (
          <section className="min-h-0 flex-1">
            {error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-4 text-xs text-rose-200">
                {error}
              </div>
            ) : (
              <CompareHub
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
            <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-md border border-slate-800 bg-slate-900 lg:w-64 xl:w-72">
          <div className="border-b border-slate-800 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-100">Artemis IV study sites</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-slate-800 p-3">
            <CustomSiteForm
              onAdd={handleAddCustomSite}
              customSiteCount={customSites.length}
              onClear={handleClearCustomSites}
              pickMode={pickMode}
              onTogglePickMode={handleTogglePickMode}
              pickRequest={pickRequest}
            />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
                {error}
              </div>
            )}

            {!error && !dataset && (
              <div className="p-3 text-xs text-slate-400">Loading sites…</div>
            )}

            <ul className="divide-y divide-slate-800">
            {sites.map((site) => {
              const isSelected = selectedSite?.id === site.id;
              const isComparison = site.role === 'comparison';
              const siteSeason =
                site.seasons?.[selectedSeasonId] ??
                (site.seasons ? Object.values(site.seasons)[0] : undefined);

              return (
                <li key={site.id}>
                <button
                  type="button"
                  onClick={() => setSelectedSite(site)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'border-slate-100 bg-slate-800'
                      : 'border-transparent hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-lg font-semibold leading-tight text-slate-50">
                      {site.name}
                    </span>
                    <span className={`text-xs ${isComparison ? 'text-sky-300' : 'text-slate-400'}`}>
                      {isComparison ? 'Comparison' : site.role === 'custom' ? 'Custom' : 'Study'}
                    </span>
                  </div>

                  <div className="mt-0.5 flex items-center justify-between font-mono text-sm text-slate-400">
                    <span>
                      {formatLunarLatLon(
                        site.coordinates.latitudeDeg,
                        site.coordinates.longitudeDeg,
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mountain className="h-3 w-3 text-slate-500" />
                      {site.coordinates.elevationM >= 0 ? '+' : ''}
                      {site.coordinates.elevationM.toFixed(0)} m
                    </span>
                  </div>

                  {siteSeason && (
                    <div className="mt-1.5 flex items-center gap-4 font-mono text-sm">
                      <span className="inline-flex items-center gap-1.5 text-amber-300">
                        <Sun className="h-3 w-3" />
                        {siteSeason.kpis.sunlightAvailabilityPct.toFixed(0)}% sunlit
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sky-300">
                        <Radio className="h-3 w-3" />
                        {siteSeason.kpis.earthLineOfSightPct.toFixed(0)}% Earth
                      </span>
                    </div>
                  )}
                </button>
                </li>
              );
            })}
            </ul>
          </div>
        </aside>

        {/* Map Viewport */}
        <section className="min-h-[380px] flex-1 lg:min-h-0">
      <LunarSouthPoleMap
          onSelectSite={handleMapSelectSite}
          onPickPoint={handleMapPickPoint}
          pickMode={pickMode}
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
