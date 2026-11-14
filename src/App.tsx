import { useEffect, useState } from 'react';
import { Globe2, MapPin, Mountain } from 'lucide-react';
import { LunarSouthPoleMap } from './components/LunarSouthPoleMap';
import type { LunarSite, SitesDataset } from './types/lunar';
import { formatLunarLatLon } from './utils/lunarProjection';

export function App() {
  const [dataset, setDataset] = useState<SitesDataset | null>(null);
  const [selectedSite, setSelectedSite] = useState<LunarSite | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/sites.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load /data/sites.json (${res.status})`);
        }
        return res.json() as Promise<SitesDataset>;
      })
      .then((data) => {
        if (!cancelled) {
          setDataset(data);
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

  const sites = dataset?.sites ?? [];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/70 px-4 py-2.5 backdrop-blur-md">
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

        <div className="hidden items-center gap-3 text-xs text-slate-400 sm:flex">
          <span className="rounded-md border border-slate-800 bg-slate-950/70 px-2.5 py-1 font-mono text-[11px] text-slate-300">
            {sites.length} Sites Loaded
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row">
        {/* Sidebar: Candidate & Comparison Sites */}
        <aside className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 lg:w-80">
          <div className="border-b border-slate-800 px-3.5 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Artemis South Pole Sites
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

              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSelectedSite(isSelected ? null : site)}
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
                      {site.coordinates.elevationM.toFixed(1)} m
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Map Viewport */}
        <section className="min-h-[420px] flex-1">
          <LunarSouthPoleMap
            sites={sites}
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
          />
        </section>
      </main>
    </div>
  );
}

export default App;
