import { useEffect } from 'react';
import { BookMarked, Compass, ExternalLink, Layers, Orbit, X } from 'lucide-react';
import type { SitesMetadata } from '../types/lunar';

interface DataCitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata?: SitesMetadata;
}

export function DataCitationsModal({
  isOpen,
  onClose,
  metadata,
}: DataCitationsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citations-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
              <BookMarked className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="citations-modal-title"
                className="text-sm font-bold tracking-tight text-white"
              >
                Data Sources &amp; NASA Citations
              </h2>
              <p className="text-[11px] text-slate-400">
                Authoritative lunar topography, imagery, and ephemeris datasets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            aria-label="Close Data & NASA Citations modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3.5 overflow-y-auto p-5 text-xs leading-relaxed text-slate-300">
          {/* Artemis IV mission context */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Artemis IV Mission Context
                </h3>
                <p className="mt-2 text-slate-300">
                  NASA describes Artemis IV as a planned 2028 crewed lunar South Pole landing. The
                  coordinates shown here are illustrative study points, not NASA-selected Artemis IV
                  landing sites. Seasonal presets are analysis windows, not official mission dates.
                </p>
              </div>
              <a
                href="https://www.nasa.gov/mission/artemis-iv/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-amber-300 transition hover:bg-slate-700"
              >
                <span>NASA mission</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          {/* 1. NASA LRO LOLA */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="h-4 w-4 shrink-0 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  NASA LRO LOLA Topography
                </h3>
              </div>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                LDEM_80S_80M.IMG
              </span>
            </div>
            <p className="mt-2 text-slate-300">
              360° terrain horizon masks and site elevations are ray-traced from the{' '}
              <strong className="text-white">
                Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA)
              </strong>{' '}
              South Pole 80 m/pixel Digital Elevation Model (80°S–90°S), referenced to a{' '}
              <span className="font-mono text-slate-200">
                {metadata?.referenceRadiusKm ?? 1737.4} km
              </span>{' '}
              lunar sphere with a{' '}
              <span className="font-mono text-slate-200">
                {(metadata?.observerHeightM ?? 2.0).toFixed(1)} m
              </span>{' '}
              surface observer mast height at{' '}
              <span className="font-mono text-slate-200">
                {metadata?.horizonMaskResolutionDeg ?? 1}°
              </span>{' '}
              azimuthal resolution.
            </p>
            <p className="mt-2 font-mono text-[11px] text-slate-400">
              Credit: NASA Goddard Space Flight Center / LRO LOLA Science Team (PDS Geosciences Node).
            </p>
          </div>

          {/* 2. ASU / LROC Lunaserv WMS */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 shrink-0 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                  ASU / LROC Lunaserv WMS
                </h3>
              </div>
              <a
                href="https://lunaserv.lroc.asu.edu/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-sky-300 transition hover:bg-slate-700"
              >
                <span>lunaserv.lroc.asu.edu</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <p className="mt-2 text-slate-300">
              Interactive South Pole basemap tiles are served via the{' '}
              <strong className="text-white">
                Arizona State University (ASU) / LROC Lunaserv Web Map Service (WMS)
              </strong>{' '}
              in Lunar South Pole Stereographic projection (
              <span className="font-mono text-slate-200">IAU2000:30120</span>), providing both LROC
              Wide Angle Camera (WAC) imagery and LOLA shaded-relief elevation layers.
            </p>
            <p className="mt-2 font-mono text-[11px] text-slate-400">
              Credit: ASU School of Earth and Space Exploration / LROC Operations Center &amp; NASA.
            </p>
          </div>

          {/* 3. NASA JPL Horizons */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Orbit className="h-4 w-4 shrink-0 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  NASA JPL Horizons Ephemeris
                </h3>
              </div>
              <a
                href="https://ssd.jpl.nasa.gov/horizons/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-emerald-300 transition hover:bg-slate-700"
              >
                <span>ssd.jpl.nasa.gov/horizons</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <p className="mt-2 text-slate-300">
              Hourly Sun and Earth topocentric azimuth/elevation series (including Earth lunar
              libration) are computed from{' '}
              <strong className="text-white">NASA JPL Horizons (DE441)</strong> in the{' '}
              <span className="font-mono text-slate-200">
                {metadata?.coordinateFrame ?? 'MEAN_ME (Mean Earth / Polar Axis)'}
              </span>{' '}
              frame with atmospheric refraction disabled across 30-day analysis windows. The
              visibility metric indicates geometric line of sight above modeled terrain only; it
              does not model radios, link budgets, or ground-network availability. Selecting
              a custom date requests a fresh hourly series; if a server-side Horizons request is
              unavailable, the timeline uses the same deterministic analytical lunar ephemeris
              and libration model used by the data-generation fallback.
            </p>
            <p className="mt-2 font-mono text-[11px] text-slate-400">
              Credit: Jet Propulsion Laboratory, California Institute of Technology / NASA Solar System Dynamics.
            </p>
          </div>

          {/* Dataset Provenance Metadata */}
          {metadata && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-950/40 px-3.5 py-2.5 font-mono text-[10px] text-slate-400">
              <span>Body: {metadata.body}</span>
              <span>Ephemeris: {metadata.ephemerisSource}</span>
              <span>Generated: {metadata.generatedAt}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-800 bg-slate-900/90 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-amber-500/20 px-4 py-1.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40 transition hover:bg-amber-500/30"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
