import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import TileWMS from 'ol/source/TileWMS';
import ImageStatic from 'ol/source/ImageStatic';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Overlay from 'ol/Overlay';
import { ScaleLine, defaults as defaultControls } from 'ol/control';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import {
  AlertTriangle,
  Compass,
  Layers,
  MapPin,
  Mountain,
  RefreshCw,
  Sun,
  Wifi,
  X,
} from 'lucide-react';
import type { BaseLayerId, LunarSite, WmsStatus } from '../types/lunar';
import {
  LOLA_SOUTH_POLE_EXTENT,
  LUNAR_SOUTH_POLE_SRS,
  ensureLunarProjection,
  formatLunarLatLon,
  lunarLatLonToStereo,
  stereoToLunarLatLon,
} from '../utils/lunarProjection';

interface LunarSouthPoleMapProps {
  sites: LunarSite[];
  selectedSite: LunarSite | null;
  onSelectSite: (site: LunarSite | null) => void;
}

const LUNASERV_WMS_URL = 'https://wms.im-ldi.com/';
const FALLBACK_IMAGE_URL = `${import.meta.env.BASE_URL}data/lola-south-pole-fallback.png`;
const WMS_TIMEOUT_MS = 7000;

function createPolarGridFeatures(): Feature[] {
  const features: Feature[] = [];
  const latitudes = [-89, -88, -86, -84, -82];

  for (const lat of latitudes) {
    const coords: [number, number][] = [];
    for (let lon = 0; lon <= 360; lon += 5) {
      coords.push(lunarLatLonToStereo(lat, lon));
    }
    const ring = new Feature({
      geometry: new LineString(coords),
      label: `${Math.abs(lat)}°S`,
    });
    ring.setStyle(
      new Style({
        stroke: new Stroke({
          color: lat === -89 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(148, 163, 184, 0.18)',
          width: 1,
          lineDash: [4, 4],
        }),
      }),
    );
    features.push(ring);
  }

  for (const lon of [0, 90, 180, 270]) {
    const start = lunarLatLonToStereo(-89.95, lon);
    const end = lunarLatLonToStereo(-81.5, lon);
    const meridian = new Feature({
      geometry: new LineString([start, end]),
    });
    meridian.setStyle(
      new Style({
        stroke: new Stroke({
          color: 'rgba(148, 163, 184, 0.16)',
          width: 1,
        }),
      }),
    );
    features.push(meridian);
  }

  return features;
}

function getSiteStyle(site: LunarSite, isSelected: boolean): Style {
  const isComparison = site.role === 'comparison';
  const baseColor = isComparison ? '#38bdf8' : '#f59e0b';
  const fillColor = isSelected
    ? isComparison
      ? '#0ea5e9'
      : '#fbbf24'
    : baseColor;

  return new Style({
    image: new CircleStyle({
      radius: isSelected ? 9 : 6.5,
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({
        color: isSelected ? '#ffffff' : '#0f172a',
        width: isSelected ? 2.5 : 2,
      }),
    }),
    text: new Text({
      text: site.name,
      offsetY: -16,
      font: `${isSelected ? '700' : '600'} 11px ui-sans-serif, system-ui, sans-serif`,
      fill: new Fill({ color: isSelected ? '#fef3c7' : '#e2e8f0' }),
      stroke: new Stroke({ color: 'rgba(2, 6, 23, 0.9)', width: 3 }),
    }),
  });
}

export function LunarSouthPoleMap({
  sites,
  selectedSite,
  onSelectSite,
}: LunarSouthPoleMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const popupContainerRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<Map | null>(null);
  const popupOverlayRef = useRef<Overlay | null>(null);
  const wacLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const lolaLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const illumLayerRef = useRef<TileLayer<TileWMS> | null>(null);
  const fallbackLayerRef = useRef<ImageLayer<ImageStatic> | null>(null);
  const sitesSourceRef = useRef<VectorSource | null>(null);

  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerId>('wac');
  const [showIllumination, setShowIllumination] = useState<boolean>(false);
  const [wmsStatus, setWmsStatus] = useState<WmsStatus>('loading');
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<string>('90.0000°S, 0.0000°E');
  const [retryCounter, setRetryCounter] = useState<number>(0);
  const [isMapCardOpen, setIsMapCardOpen] = useState<boolean>(false);

  // Initialize OpenLayers Map once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const projection = ensureLunarProjection();

    const wacSource = new TileWMS({
      url: LUNASERV_WMS_URL,
      params: {
        LAYERS: 'luna_wac_roi_south_summer',
        FORMAT: 'image/png',
        VERSION: '1.1.1',
        TRANSPARENT: false,
      },
      projection,
    });

    const lolaSource = new TileWMS({
      url: LUNASERV_WMS_URL,
      params: {
        LAYERS: 'luna_wac_dtm_hillshade',
        FORMAT: 'image/png',
        VERSION: '1.1.1',
        TRANSPARENT: false,
      },
      projection,
    });

    const illumSource = new TileWMS({
      url: LUNASERV_WMS_URL,
      params: {
        LAYERS: 'luna_polar_illumination_pct',
        FORMAT: 'image/png',
        VERSION: '1.1.1',
        TRANSPARENT: true,
      },
      projection,
    });

    const fallbackLayer = new ImageLayer({
      source: new ImageStatic({
        url: FALLBACK_IMAGE_URL,
        projection,
        imageExtent: LOLA_SOUTH_POLE_EXTENT,
      }),
      visible: false,
    });

    const wacLayer = new TileLayer({
      source: wacSource,
      visible: true,
    });

    const lolaLayer = new TileLayer({
      source: lolaSource,
      visible: false,
    });

    const illumLayer = new TileLayer({
      source: illumSource,
      opacity: 0.55,
      visible: false,
    });

    const gridLayer = new VectorLayer({
      source: new VectorSource({ features: createPolarGridFeatures() }),
    });

    const sitesSource = new VectorSource();
    const sitesLayer = new VectorLayer({
      source: sitesSource,
    });

    const popupOverlay = new Overlay({
      element: popupContainerRef.current ?? undefined,
      autoPan: {
        animation: { duration: 220 },
      },
      positioning: 'bottom-center',
      offset: [0, -14],
    });

    const map = new Map({
      target: mapContainerRef.current,
      layers: [fallbackLayer, wacLayer, lolaLayer, illumLayer, gridLayer, sitesLayer],
      overlays: [popupOverlay],
      controls: defaultControls({ attribution: true, zoom: true, rotate: false }).extend([
        new ScaleLine({ units: 'metric' }),
      ]),
      view: new View({
        projection,
        center: [0, 0],
        zoom: 2,
        minZoom: 0,
        maxZoom: 9,
        extent: [-450_000, -450_000, 450_000, 450_000],
      }),
    });

    map.on('pointermove', (evt) => {
      if (evt.dragging) return;
      const { latitudeDeg, longitudeDeg } = stereoToLunarLatLon(
        evt.coordinate[0],
        evt.coordinate[1],
      );
      setCursorCoords(formatLunarLatLon(latitudeDeg, longitudeDeg));

      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (layer) => layer === sitesLayer,
      });
      const targetEl = map.getTargetElement();
      if (targetEl) {
        targetEl.style.cursor = hit ? 'pointer' : '';
      }
    });

    map.on('singleclick', (evt) => {
      const feature = map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => f,
        { layerFilter: (layer) => layer === sitesLayer },
      );
      if (feature) {
        const site = feature.get('siteData') as LunarSite | undefined;
        if (site) {
          setIsMapCardOpen(true);
          onSelectSite(site);
          return;
        }
      }
      onSelectSite(null);
    });

    mapRef.current = map;
    popupOverlayRef.current = popupOverlay;
    wacLayerRef.current = wacLayer;
    lolaLayerRef.current = lolaLayer;
    illumLayerRef.current = illumLayer;
    fallbackLayerRef.current = fallbackLayer;
    sitesSourceRef.current = sitesSource;

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [onSelectSite]);

  // Monitor WMS tile loading and trigger automatic local fallback on error or timeout
  useEffect(() => {
    const activeLayer =
      activeBaseLayer === 'wac' ? wacLayerRef.current : lolaLayerRef.current;
    const source = activeLayer?.getSource();
    if (!source) return;

    let loadedCount = 0;
    let errorCount = 0;
    let settled = false;

    setWmsStatus('loading');
    setFallbackReason(null);

    const activateFallback = (reason: string) => {
      if (settled) return;
      settled = true;
      setWmsStatus('fallback');
      setFallbackReason(reason);
    };

    const timeoutId = window.setTimeout(() => {
      if (loadedCount === 0) {
        activateFallback('Lunaserv WMS request timed out');
      }
    }, WMS_TIMEOUT_MS);

    const handleLoadEnd = () => {
      loadedCount += 1;
      if (!settled) {
        settled = true;
        window.clearTimeout(timeoutId);
        setWmsStatus('live');
        setFallbackReason(null);
      }
    };

    const handleLoadError = () => {
      errorCount += 1;
      if (loadedCount === 0 && errorCount >= 2) {
        window.clearTimeout(timeoutId);
        activateFallback('Lunaserv WMS tiles failed to load');
      }
    };

    source.on('tileloadend', handleLoadEnd);
    source.on('tileloaderror', handleLoadError);

    return () => {
      window.clearTimeout(timeoutId);
      source.un('tileloadend', handleLoadEnd);
      source.un('tileloaderror', handleLoadError);
    };
  }, [activeBaseLayer, retryCounter]);

  // Synchronize layer visibility with base layer, illumination toggle, and fallback state
  useEffect(() => {
    const useFallback = wmsStatus === 'fallback';
    wacLayerRef.current?.setVisible(!useFallback && activeBaseLayer === 'wac');
    lolaLayerRef.current?.setVisible(!useFallback && activeBaseLayer === 'lola');
    illumLayerRef.current?.setVisible(!useFallback && showIllumination);
    fallbackLayerRef.current?.setVisible(useFallback);
  }, [activeBaseLayer, showIllumination, wmsStatus]);

  // Plot all sites from /public/data/sites.json and update selection styling
  useEffect(() => {
    const source = sitesSourceRef.current;
    if (!source) return;

    source.clear();
    const features = sites.map((site) => {
      const [x, y] = lunarLatLonToStereo(
        site.coordinates.latitudeDeg,
        site.coordinates.longitudeDeg,
      );
      const feature = new Feature({
        geometry: new Point([x, y]),
        siteData: site,
      });
      const isSelected = selectedSite?.id === site.id;
      feature.setStyle(getSiteStyle(site, isSelected));
      return feature;
    });
    source.addFeatures(features);
  }, [sites, selectedSite]);

  // Re-open the map card when selectedSite changes
  useEffect(() => {
    setIsMapCardOpen(Boolean(selectedSite));
  }, [selectedSite]);

  // Position popup & smoothly pan when a site is selected
  useEffect(() => {
    const overlay = popupOverlayRef.current;
    const view = mapRef.current?.getView();
    if (!overlay || !view) return;

    if (!selectedSite || !isMapCardOpen) {
      overlay.setPosition(undefined);
      return;
    }

    const coords = lunarLatLonToStereo(
      selectedSite.coordinates.latitudeDeg,
      selectedSite.coordinates.longitudeDeg,
    );
    overlay.setPosition(coords);
    view.animate({
      center: coords,
      duration: 300,
    });
  }, [selectedSite, isMapCardOpen]);

  const handleRetryWms = () => {
    wacLayerRef.current?.getSource()?.refresh();
    lolaLayerRef.current?.getSource()?.refresh();
    setRetryCounter((c) => c + 1);
  };

  const handleResetView = () => {
    mapRef.current?.getView().animate({
      center: [0, 0],
      zoom: 2,
      duration: 300,
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
      {/* OpenLayers Canvas */}
      <div ref={mapContainerRef} className="h-full w-full" />

      {/* Top-Left Layer Switcher & WMS Status */}
      <div className="pointer-events-none absolute top-3 left-12 z-10 flex flex-wrap items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/85 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveBaseLayer('wac')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              activeBaseLayer === 'wac'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            LROC WAC Imagery
          </button>
          <button
            type="button"
            onClick={() => setActiveBaseLayer('lola')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              activeBaseLayer === 'lola'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Mountain className="h-3.5 w-3.5" />
            LOLA Shaded Relief
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowIllumination((v) => !v)}
          disabled={wmsStatus === 'fallback'}
          title="Toggle LROC WAC Polar Illumination overlay"
          className={`pointer-events-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium backdrop-blur-md transition ${
            showIllumination && wmsStatus !== 'fallback'
              ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
              : 'border-slate-700/80 bg-slate-900/85 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45'
          }`}
        >
          <Sun className="h-3.5 w-3.5" />
          Illumination
        </button>
      </div>

      {/* Top-Right Status Badge & Center Pole Button */}
      <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-2">
        <div
          className={`pointer-events-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium backdrop-blur-md ${
            wmsStatus === 'live'
              ? 'border-emerald-500/40 bg-emerald-950/80 text-emerald-300'
              : wmsStatus === 'loading'
                ? 'border-sky-500/40 bg-sky-950/80 text-sky-300'
                : 'border-amber-500/50 bg-amber-950/85 text-amber-200'
          }`}
          title={fallbackReason ?? 'ASU/NASA Lunaserv WMS'}
        >
          {wmsStatus === 'live' && <Wifi className="h-3.5 w-3.5" />}
          {wmsStatus === 'loading' && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          {wmsStatus === 'fallback' && <AlertTriangle className="h-3.5 w-3.5" />}
          <span>
            {wmsStatus === 'live'
              ? 'Lunaserv WMS'
              : wmsStatus === 'loading'
                ? 'Connecting WMS…'
                : 'Local LOLA Fallback'}
          </span>
          {wmsStatus === 'fallback' && (
            <button
              type="button"
              onClick={handleRetryWms}
              className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/35"
            >
              Retry
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleResetView}
          title="Center on Lunar South Pole (90°S)"
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/85 px-2.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md transition hover:border-amber-500/50 hover:text-amber-300"
        >
          <Compass className="h-3.5 w-3.5" />
          90°S
        </button>
      </div>

      {/* Bottom-Right Projection & Cursor Telemetry */}
      <div className="pointer-events-none absolute right-3 bottom-8 z-10 flex items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-900/85 px-3 py-1.5 font-mono text-[11px] text-slate-300 backdrop-blur-md">
        <span className="text-slate-400">{LUNAR_SOUTH_POLE_SRS}</span>
        <span className="text-slate-600">|</span>
        <span>{cursorCoords}</span>
      </div>

      {/* Interactive Site Popup Overlay */}
      <div ref={popupContainerRef} className="z-20">
        {selectedSite && isMapCardOpen && (
          <div className="w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 text-slate-100 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin
                  className={`h-4 w-4 shrink-0 ${
                    selectedSite.role === 'comparison'
                      ? 'text-sky-400'
                      : 'text-amber-400'
                  }`}
                />
                <div>
                  <h3 className="text-sm font-semibold leading-tight text-white">
                    {selectedSite.name}
                  </h3>
                  <span
                    className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      selectedSite.role === 'comparison'
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {selectedSite.role}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMapCardOpen(false);
                  popupOverlayRef.current?.setPosition(undefined);
                }}
                aria-label="Close site details"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2 font-mono text-[11px]">
              <div>
                <div className="text-[10px] uppercase text-slate-500">Coordinates</div>
                <div className="text-slate-200">
                  {formatLunarLatLon(
                    selectedSite.coordinates.latitudeDeg,
                    selectedSite.coordinates.longitudeDeg,
                  )}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-slate-500">Elevation</div>
                <div className="text-slate-200">
                  {selectedSite.coordinates.elevationM >= 0 ? '+' : ''}
                  {selectedSite.coordinates.elevationM.toFixed(1)} m
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-slate-300">
              {selectedSite.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
