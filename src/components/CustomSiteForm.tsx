import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Crosshair, Loader2, MousePointerClick, Trash2 } from 'lucide-react';
import { CUSTOM_SITE_MAX_LATITUDE_DEG, validateCustomCoordinates } from '../utils/horizonMask';

interface CustomSiteFormProps {
  /** Builds the site (this downloads terrain tiles) and selects it. Throws on failure. */
  onAdd: (latitudeDeg: number, longitudeDeg: number, name: string) => Promise<void>;
  customSiteCount: number;
  onClear: () => void;
  /** While on, clicks on the map are sent to this form (see pickRequest). */
  pickMode: boolean;
  onTogglePickMode: () => void;
  /** A point the user clicked on the map. A new nonce means a new click. */
  pickRequest: { latitudeDeg: number; longitudeDeg: number; nonce: number } | null;
}

const inputClass =
  'w-full rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-1 font-mono text-[11px] text-slate-100 placeholder:text-slate-600 focus:border-amber-500/60 focus:outline-none';

export function CustomSiteForm({
  onAdd,
  customSiteCount,
  onClear,
  pickMode,
  onTogglePickMode,
  pickRequest,
}: CustomSiteFormProps) {
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPoint = async (latText: string, lonText: string, siteName: string) => {
    const latitude = Number(latText);
    const longitude = Number(lonText);
    if (latText.trim() === '' || lonText.trim() === '') {
      setError('Enter a latitude and a longitude.');
      return;
    }
    const check = validateCustomCoordinates(latitude, longitude);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onAdd(latitude, longitude, siteName);
      setLat('');
      setLon('');
      setName('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not compute the terrain horizon for that point.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submitPoint(lat, lon, name);
  };

  // A click on the map arrives as a pickRequest; handle each new click once.
  const lastNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!pickRequest || pickRequest.nonce === lastNonce.current) return;
    lastNonce.current = pickRequest.nonce;
    // Four decimals is about 3 m, finer than the 80 m terrain grid.
    const latText = pickRequest.latitudeDeg.toFixed(4);
    const lonText = pickRequest.longitudeDeg.toFixed(4);
    setLat(latText);
    setLon(lonText);
    void submitPoint(latText, lonText, '');
    // submitPoint only reads props and setters, so it is safe to leave out of the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickRequest]);

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5 rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          <Crosshair className="h-3.5 w-3.5 text-amber-400" />
          Custom coordinates
        </h3>
        {customSiteCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-300 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Clear ({customSiteCount})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="text-[10px] text-slate-400">
          Latitude (°)
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="-88.5"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            disabled={busy}
            aria-label="Latitude in degrees, south negative"
          />
        </label>
        <label className="text-[10px] text-slate-400">
          Longitude (°E)
          <input
            className={inputClass}
            inputMode="decimal"
            placeholder="45.0"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            disabled={busy}
            aria-label="Longitude in degrees east"
          />
        </label>
      </div>
      <input
        className={inputClass}
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={busy}
        aria-label="Site name, optional"
      />

      <button
        type="button"
        onClick={onTogglePickMode}
        aria-pressed={pickMode}
        className={`inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
          pickMode
            ? 'border-amber-400 bg-amber-500/30 text-amber-100'
            : 'border-slate-700/80 bg-slate-900/70 text-slate-200 hover:border-amber-500/50'
        }`}
      >
        <MousePointerClick className="h-3 w-3" />
        {pickMode ? 'Picking: click the map (click to stop)' : 'Pick on map'}
      </button>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {busy ? 'Loading terrain…' : 'Add site'}
      </button>

      {error ? (
        <p role="alert" className="text-[10px] leading-snug text-rose-300">
          {error}
        </p>
      ) : (
        <p className="text-[10px] leading-snug text-slate-500">
          Poleward of {Math.abs(CUSTOM_SITE_MAX_LATITUDE_DEG)}°S. The first point downloads about 13 MB of terrain
          tiles; nearby points reuse them.
        </p>
      )}
    </form>
  );
}
