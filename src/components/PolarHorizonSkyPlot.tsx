import { useId, useMemo, useRef, useState } from 'react';
import { Compass, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import type { HourlyPoint, LunarSite, ViewMode } from '../types/lunar';
import {
  cartesianToPolar,
  formatSignedDeg,
  polarToCartesian,
} from '../utils/lunarAnalytics';

export type ZoomMode = 'wide' | 'horizon';

interface PolarHorizonSkyPlotProps {
  site: LunarSite;
  hourly: HourlyPoint[];
  hourIndex: number;
  viewMode: ViewMode;
  zoomMode?: ZoomMode;
  onToggleZoom?: () => void;
  subtitle?: string;
}

const SVG_SIZE = 420;
const CX = SVG_SIZE / 2;
const CY = SVG_SIZE / 2;
const RADIUS = 162;

export function PolarHorizonSkyPlot({
  site,
  hourly,
  hourIndex,
  viewMode,
  zoomMode: controlledZoomMode,
  onToggleZoom,
  subtitle,
}: PolarHorizonSkyPlotProps) {
  const [internalZoomMode, setInternalZoomMode] = useState<ZoomMode>('wide');
  const zoomMode = controlledZoomMode ?? internalZoomMode;
  const handleToggleZoom = () => {
    if (onToggleZoom) {
      onToggleZoom();
    } else {
      setInternalZoomMode((z) => (z === 'wide' ? 'horizon' : 'wide'));
    }
  };

  const uid = useId().replace(/:/g, '');
  const skyBgGradId = `skyBgGrad-${uid}`;
  const terrainMaskGradId = `terrainMaskGrad-${uid}`;
  const sunGlowId = `sunGlow-${uid}`;
  const earthGlowId = `earthGlow-${uid}`;
  const [hoverInfo, setHoverInfo] = useState<{
    azimuthDeg: number;
    elevationDeg: number;
    maskDeg: number;
    isClear: boolean;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const minEl = -10;
  const maxEl = zoomMode === 'wide' ? 40 : 15;

  const horizonMask = site.horizonMaskDeg ?? [];
  const currentPoint = hourly[hourIndex] ?? hourly[0];

  // Build SVG evenodd path: outer boundary circle + inner jagged terrain contour
  const { terrainFillPath, terrainRidgePath } = useMemo(() => {
    if (horizonMask.length === 0) {
      return { terrainFillPath: '', terrainRidgePath: '' };
    }

    const outerCircle = [
      `M ${CX - RADIUS} ${CY}`,
      `A ${RADIUS} ${RADIUS} 0 1 0 ${CX + RADIUS} ${CY}`,
      `A ${RADIUS} ${RADIUS} 0 1 0 ${CX - RADIUS} ${CY}`,
      'Z',
    ].join(' ');

    const ridgePoints: string[] = [];
    for (let az = 0; az < horizonMask.length; az++) {
      const el = horizonMask[az];
      const { x, y } = polarToCartesian(CX, CY, RADIUS, az, el, minEl, maxEl);
      ridgePoints.push(`${az === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    const ridgeClosed = `${ridgePoints.join(' ')} Z`;

    return {
      terrainFillPath: `${outerCircle} ${ridgeClosed}`,
      terrainRidgePath: ridgeClosed,
    };
  }, [horizonMask, minEl, maxEl]);

  // Split Sun and Earth hourly paths into contiguous visible/occluded polyline segments
  const { sunSegments, earthSegments } = useMemo(() => {
    type Segment = { visible: boolean; points: string };

    const buildSegments = (
      getCoords: (pt: HourlyPoint) => { az: number; el: number; visible: boolean },
    ): Segment[] => {
      if (hourly.length === 0) return [];
      const segments: Segment[] = [];
      let currentVisible = getCoords(hourly[0]).visible;
      let pts: string[] = [];

      for (let i = 0; i < hourly.length; i++) {
        const { az, el, visible } = getCoords(hourly[i]);
        const { x, y } = polarToCartesian(CX, CY, RADIUS, az, el, minEl, maxEl);
        const coordStr = `${x.toFixed(1)},${y.toFixed(1)}`;

        if (visible !== currentVisible && pts.length > 0) {
          // Bridge to transition point for continuous path
          pts.push(coordStr);
          segments.push({ visible: currentVisible, points: pts.join(' ') });
          currentVisible = visible;
          pts = [coordStr];
        } else {
          pts.push(coordStr);
        }
      }

      if (pts.length > 0) {
        segments.push({ visible: currentVisible, points: pts.join(' ') });
      }
      return segments;
    };

    return {
      sunSegments: buildSegments((pt) => ({
        az: pt.sunAzimuthDeg,
        el: pt.sunElevationDeg,
        visible: pt.sunVisible,
      })),
      earthSegments: buildSegments((pt) => ({
        az: pt.earthAzimuthDeg,
        el: pt.earthElevationDeg,
        visible: pt.earthVisible,
      })),
    };
  }, [hourly, minEl, maxEl]);

  const elevationRings = useMemo(() => {
    const levels = zoomMode === 'wide' ? [-5, 0, 10, 20, 30] : [-5, 0, 5, 10];
    return levels.map((el) => {
      const r = ((maxEl - el) / (maxEl - minEl)) * RADIUS;
      return { el, r };
    });
  }, [zoomMode, minEl, maxEl]);

  const sunPos = currentPoint
    ? polarToCartesian(
        CX,
        CY,
        RADIUS,
        currentPoint.sunAzimuthDeg,
        currentPoint.sunElevationDeg,
        minEl,
        maxEl,
      )
    : null;

  const earthPos = currentPoint
    ? polarToCartesian(
        CX,
        CY,
        RADIUS,
        currentPoint.earthAzimuthDeg,
        currentPoint.earthElevationDeg,
        minEl,
        maxEl,
      )
    : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = SVG_SIZE / rect.width;
    const scaleY = SVG_SIZE / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const { azimuthDeg, elevationDeg, withinPlot } = cartesianToPolar(
      CX,
      CY,
      RADIUS,
      x,
      y,
      minEl,
      maxEl,
    );

    if (!withinPlot) {
      setHoverInfo(null);
      return;
    }

    const azIdx = Math.round(azimuthDeg) % 360;
    const maskDeg = horizonMask[azIdx] ?? 0;
    setHoverInfo({
      azimuthDeg,
      elevationDeg,
      maskDeg,
      isClear: elevationDeg > maskDeg,
    });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-amber-400" />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              360° Polar Horizon Sky-Plot
            </h3>
            <p className="text-[11px] text-slate-400">
              {subtitle ?? 'Terrain horizon mask + 30-day Sun & Earth (libration) paths'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleZoom}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
          title="Toggle radial elevation scale"
        >
          {zoomMode === 'wide' ? (
            <>
              <ZoomIn className="h-3.5 w-3.5 text-amber-400" />
              <span>Horizon Zoom (-10°..+15°)</span>
            </>
          ) : (
            <>
              <ZoomOut className="h-3.5 w-3.5 text-sky-400" />
              <span>Wide Scale (-10°..+40°)</span>
            </>
          )}
        </button>
      </div>

      {/* Explorer-mode micro-callout */}
      {viewMode === 'explorer' && (
        <div className="mt-2.5 rounded-lg border border-sky-500/30 bg-sky-950/25 px-3 py-2 text-[11px] leading-relaxed text-sky-100/90">
          <span className="font-semibold text-sky-300">How to read this sky-plot:</span>{' '}
          Imagine lying on your back at <span className="font-medium text-white">{site.name}</span>{' '}
          looking straight up. The <span className="text-slate-300 font-medium">dark jagged ring</span>{' '}
          is the surrounding crater walls and ridges blocking the horizon. When the{' '}
          <span className="text-amber-300 font-medium">Sun</span> or{' '}
          <span className="text-sky-300 font-medium">Earth&apos;s figure-8 wobble</span>{' '}
          moves inside the clear inner sky, it is visible; when it crosses outside the jagged ridge,
          terrain blocks it!
        </div>
      )}

      {/* Plot Container */}
      <div className="relative mt-3 flex flex-col items-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          className="w-full max-w-[380px] select-none overflow-visible"
          role="img"
          aria-label={`360 degree polar horizon sky-plot for ${site.name}`}
        >
          <defs>
            <radialGradient id={skyBgGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="75%" stopColor="#090f1d" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>
            <radialGradient id={terrainMaskGradId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" stopOpacity="0.82" />
              <stop offset="65%" stopColor="#0f172a" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0.97" />
            </radialGradient>
            <filter id={sunGlowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={earthGlowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Sky Dome Background */}
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill={`url(#${skyBgGradId})`}
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth={1.2}
          />

          {/* Terrain Horizon Mask (blocked region from outer rim inward to ridge) */}
          {terrainFillPath && (
            <path
              d={terrainFillPath}
              fill={`url(#${terrainMaskGradId})`}
              fillRule="evenodd"
            />
          )}

          {/* Elevation Rings */}
          {elevationRings.map(({ el, r }) => {
            const isZeroHorizon = el === 0;
            return (
              <g key={el}>
                <circle
                  cx={CX}
                  cy={CY}
                  r={r}
                  fill="none"
                  stroke={
                    isZeroHorizon
                      ? 'rgba(52, 211, 153, 0.42)'
                      : 'rgba(148, 163, 184, 0.16)'
                  }
                  strokeWidth={isZeroHorizon ? 1.2 : 0.8}
                  strokeDasharray={isZeroHorizon ? '4 3' : '2 4'}
                />
                <text
                  x={CX + 4}
                  y={CY - r + 10}
                  fill={isZeroHorizon ? '#6ee7b7' : '#64748b'}
                  fontSize="9"
                  fontFamily="ui-monospace, monospace"
                >
                  {el === 0 ? '0° Horizon' : `${el > 0 ? '+' : ''}${el}°`}
                </text>
              </g>
            );
          })}

          {/* Cardinal Spokes */}
          {[
            { az: 0, label: 'N 0°', dx: 0, dy: -12, anchor: 'middle' as const },
            { az: 90, label: 'E 90°', dx: 12, dy: 4, anchor: 'start' as const },
            { az: 180, label: 'S 180°', dx: 0, dy: 18, anchor: 'middle' as const },
            { az: 270, label: 'W 270°', dx: -12, dy: 4, anchor: 'end' as const },
          ].map((c) => {
            const outer = polarToCartesian(CX, CY, RADIUS, c.az, minEl, minEl, maxEl);
            return (
              <g key={c.az}>
                <line
                  x1={CX}
                  y1={CY}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="rgba(148, 163, 184, 0.14)"
                  strokeWidth={1}
                />
                <text
                  x={outer.x + c.dx}
                  y={outer.y + c.dy}
                  textAnchor={c.anchor}
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="ui-monospace, monospace"
                >
                  {c.label}
                </text>
              </g>
            );
          })}

          {/* Jagged Terrain Ridge Outline */}
          {terrainRidgePath && (
            <path
              d={terrainRidgePath}
              fill="none"
              stroke="rgba(148, 163, 184, 0.65)"
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          )}

          {/* 30-Day Sun Path */}
          {sunSegments.map((seg, idx) => (
            <polyline
              key={`sun-${idx}`}
              points={seg.points}
              fill="none"
              stroke={seg.visible ? '#fbbf24' : '#92400e'}
              strokeWidth={seg.visible ? 1.8 : 1.2}
              strokeDasharray={seg.visible ? undefined : '3 3'}
              strokeOpacity={seg.visible ? 0.85 : 0.45}
            />
          ))}

          {/* 30-Day Earth Path (Libration Figure-8 Wobble) */}
          {earthSegments.map((seg, idx) => (
            <polyline
              key={`earth-${idx}`}
              points={seg.points}
              fill="none"
              stroke={seg.visible ? '#38bdf8' : '#fb7185'}
              strokeWidth={seg.visible ? 2 : 1.4}
              strokeDasharray={seg.visible ? undefined : '3 3'}
              strokeOpacity={seg.visible ? 0.9 : 0.5}
            />
          ))}

          {/* Current Sun Marker */}
          {sunPos && currentPoint && (
            <g>
              <line
                x1={CX}
                y1={CY}
                x2={sunPos.x}
                y2={sunPos.y}
                stroke="rgba(251, 191, 36, 0.25)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              {currentPoint.sunVisible && (
                <circle
                  cx={sunPos.x}
                  cy={sunPos.y}
                  r={10}
                  fill="rgba(251, 191, 36, 0.22)"
                />
              )}
              <circle
                cx={sunPos.x}
                cy={sunPos.y}
                r={5.5}
                fill={currentPoint.sunVisible ? '#fbbf24' : '#451a03'}
                stroke={currentPoint.sunVisible ? '#fef3c7' : '#d97706'}
                strokeWidth={1.8}
                filter={currentPoint.sunVisible ? `url(#${sunGlowId})` : undefined}
              />
              <text
                x={sunPos.x + 9}
                y={sunPos.y - 6}
                fill={currentPoint.sunVisible ? '#fde68a' : '#f59e0b'}
                fontSize="9.5"
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
              >
                SUN
              </text>
            </g>
          )}

          {/* Current Earth Marker */}
          {earthPos && currentPoint && (
            <g>
              <line
                x1={CX}
                y1={CY}
                x2={earthPos.x}
                y2={earthPos.y}
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              {currentPoint.earthVisible && (
                <circle
                  cx={earthPos.x}
                  cy={earthPos.y}
                  r={10}
                  fill="rgba(56, 189, 248, 0.22)"
                />
              )}
              <circle
                cx={earthPos.x}
                cy={earthPos.y}
                r={5.5}
                fill={currentPoint.earthVisible ? '#0284c7' : '#4c0519'}
                stroke={currentPoint.earthVisible ? '#bae6fd' : '#fb7185'}
                strokeWidth={1.8}
                filter={currentPoint.earthVisible ? `url(#${earthGlowId})` : undefined}
              />
              {currentPoint.earthVisible && (
                <circle cx={earthPos.x - 1.2} cy={earthPos.y - 1} r={1.8} fill="#34d399" />
              )}
              <text
                x={earthPos.x + 9}
                y={earthPos.y + 11}
                fill={currentPoint.earthVisible ? '#bae6fd' : '#fda4af'}
                fontSize="9.5"
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
              >
                EARTH
              </text>
            </g>
          )}

          {/* Center Zenith Crosshair */}
          <circle cx={CX} cy={CY} r={2} fill="#64748b" />
        </svg>

        {/* Interactive Hover Readout Bar */}
        <div className="mt-2 flex min-h-[30px] w-full items-center justify-between rounded-lg border border-slate-800/90 bg-slate-950/75 px-3 py-1.5 font-mono text-[11px]">
          {hoverInfo ? (
            <>
              <span className="text-slate-300">
                Az <strong className="text-white">{hoverInfo.azimuthDeg.toFixed(0)}°</strong> · El{' '}
                <strong className="text-white">{formatSignedDeg(hoverInfo.elevationDeg, 1)}</strong>
              </span>
              <span className="text-slate-400">
                Mask: <strong className="text-slate-200">{formatSignedDeg(hoverInfo.maskDeg, 1)}</strong>
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  hoverInfo.isClear ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {hoverInfo.isClear ? (
                  <>
                    <Eye className="h-3 w-3" /> Clear Sky
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3" /> Blocked
                  </>
                )}
              </span>
            </>
          ) : (
            <span className="text-slate-500">
              Hover over the sky-plot to inspect azimuth, elevation &amp; terrain mask
            </span>
          )}
        </div>

        {/* Legend */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Sun (Visible)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            Earth DTE (Visible)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3.5 border-t-2 border-dashed border-rose-400" />
            Occluded by Terrain
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-slate-400/70 bg-slate-800" />
            Crater / Ridge Mask
          </span>
        </div>
      </div>
    </div>
  );
}
