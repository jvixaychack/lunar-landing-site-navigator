import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { HourlyPoint, SeasonMetadata } from '../types/lunar';
import { formatUtcTimestamp } from '../utils/lunarAnalytics';
import { DatePickerInput } from './DatePickerInput';

export type PlaybackSpeed = 1 | 2 | 4;

interface TimelineScrubberProps {
  hourly: HourlyPoint[];
  hourIndex: number;
  onChangeHour: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: PlaybackSpeed;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
  seasons: SeasonMetadata[];
  selectedSeasonId: string;
  onSelectSeason: (seasonId: string) => void;
  startDate: string;
  onChangeStartDate: (startDate: string) => void;
  dataSource?: string;
  isLoading?: boolean;
}

export function TimelineScrubber({
  hourly,
  hourIndex,
  onChangeHour,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  seasons,
  selectedSeasonId,
  onSelectSeason,
  startDate,
  onChangeStartDate,
  dataSource,
  isLoading = false,
}: TimelineScrubberProps) {
  const maxIndex = Math.max(0, hourly.length - 1);
  const current = hourly[hourIndex] ?? hourly[0];
  const dayNumber = Math.floor(hourIndex / 24) + 1;
  const totalDays = Math.max(1, Math.round(hourly.length / 24));
  const { dateLabel, timeLabel } = current
    ? formatUtcTimestamp(current.timestamp)
    : { dateLabel: '—', timeLabel: '' };

  const stepBy = (delta: number) => {
    if (hourly.length === 0) return;
    const next = Math.max(0, Math.min(maxIndex, hourIndex + delta));
    onChangeHour(next);
  };

  // Downsample 720 hours into 180 visual bars (4h each) for a crisp visibility strip
  const stripBuckets = 180;
  const bucketSize = Math.max(1, Math.floor(hourly.length / stripBuckets));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
      {/* Top Row: Title + Season Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-400" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              30-Day Ephemeris Timeline
            </h3>
            <p className="font-mono text-[11px] text-slate-400">
              Day {dayNumber}/{totalDays} · {dateLabel} ·{' '}
              <span className="text-slate-200">{timeLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {seasons.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5">
              {seasons.map((s) => {
                const active = s.id === selectedSeasonId && startDate === s.timeRange.start.slice(0, 10);
                const shortName = s.name.replace(/ \d{4}$/, '').replace('South Pole ', '');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectSeason(s.id)}
                    title={s.description}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {shortName}
                  </button>
                );
              })}
            </div>
          )}
          <label className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Window start (UTC)
            <DatePickerInput
              value={startDate}
              onChange={onChangeStartDate}
              ariaLabel="30-day timeline start date in UTC"
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[11px] normal-case text-slate-200 focus:border-amber-500 focus:outline-none"
            />
          </label>
        </div>
      </div>
      {(isLoading || dataSource) && (
        <p className="mt-1 text-right text-[10px] text-slate-500" aria-live="polite">
          {isLoading ? 'Calculating 30-day ephemeris…' : `Data: ${dataSource}`}
        </p>
      )}

      {/* Sun & Earth Visibility Barcode Strip */}
      {hourly.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
            <span>Sun Illumination</span>
            <span>Earth Line of Sight</span>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-800/80 bg-slate-950/90 p-1">
            {/* Sun row */}
            <div className="flex h-2 w-full gap-[1px]">
              {Array.from({ length: stripBuckets }).map((_, b) => {
                const start = b * bucketSize;
                const slice = hourly.slice(start, start + bucketSize);
                const sunRatio =
                  slice.length > 0
                    ? slice.filter((p) => p.sunVisible).length / slice.length
                    : 0;
                return (
                  <div
                    key={`sun-b-${b}`}
                    className="flex-1 rounded-[1px]"
                    style={{
                      backgroundColor:
                        sunRatio > 0.5
                          ? 'rgba(251, 191, 36, 0.85)'
                          : sunRatio > 0
                            ? 'rgba(251, 191, 36, 0.35)'
                            : 'rgba(30, 41, 59, 0.7)',
                    }}
                  />
                );
              })}
            </div>
            {/* Earth visibility row */}
            <div className="mt-1 flex h-2 w-full gap-[1px]">
              {Array.from({ length: stripBuckets }).map((_, b) => {
                const start = b * bucketSize;
                const slice = hourly.slice(start, start + bucketSize);
                const earthRatio =
                  slice.length > 0
                    ? slice.filter((p) => p.earthVisible).length / slice.length
                    : 0;
                return (
                  <div
                    key={`earth-b-${b}`}
                    className="flex-1 rounded-[1px]"
                    style={{
                      backgroundColor:
                        earthRatio > 0.5
                          ? 'rgba(56, 189, 248, 0.85)'
                          : earthRatio > 0
                            ? 'rgba(56, 189, 248, 0.35)'
                            : 'rgba(30, 41, 59, 0.7)',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Range Slider */}
      <div className="mt-2.5">
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={hourIndex}
          onChange={(e) => onChangeHour(Number(e.target.value))}
          aria-label="Scrub 30-day lunar timeline"
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400"
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-500">
          <span>Day 1</span>
          <span>Day 8</span>
          <span>Day 15</span>
          <span>Day 22</span>
          <span>Day 30</span>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePlay}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => stepBy(-24)}
            title="Step back 24 hours"
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => stepBy(-1)}
            title="Step back 1 hour"
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => stepBy(1)}
            title="Step forward 1 hour"
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => stepBy(24)}
            title="Step forward 24 hours"
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onChangeHour(0)}
            title="Reset to Day 1"
            className="rounded-lg border border-slate-800 bg-slate-950/70 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Speed Selector */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/70 p-0.5 text-[11px]">
          <span className="px-1.5 text-slate-500">Speed</span>
          {([1, 2, 4] as PlaybackSpeed[]).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onChangeSpeed(spd)}
              className={`rounded-md px-2 py-0.5 font-mono font-medium transition ${
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
    </div>
  );
}
