export type SeasonId = 'summer-solstice' | 'equinox' | 'winter-solstice' | string;

export type ViewMode = 'planner' | 'explorer' | 'compare';

export interface SiteCoordinates {
  latitudeDeg: number;
  longitudeDeg: number;
  elevationM: number;
  observerHeightM?: number;
}

export interface SeasonTimeRange {
  start: string;
  end: string;
  stepHours: number;
  durationDays: number;
  totalHours: number;
}

export interface SeasonMetadata {
  id: SeasonId;
  name: string;
  description: string;
  timeRange: SeasonTimeRange;
}

export interface SeasonKpis {
  solarPowerAvailabilityPct: number;
  continuousSunlightHours: number;
  dteCommsUptimePct: number;
  sunVisibleHours: number;
  earthVisibleHours: number;
  minSunElevationDeg: number;
  maxSunElevationDeg: number;
  minEarthElevationDeg: number;
  maxEarthElevationDeg: number;
  minHorizonMaskDeg: number;
  maxHorizonMaskDeg: number;
}

export interface HourlyPoint {
  timestamp: string;
  sunAzimuthDeg: number;
  sunElevationDeg: number;
  sunHorizonMaskDeg: number;
  sunVisible: boolean;
  earthAzimuthDeg: number;
  earthElevationDeg: number;
  earthHorizonMaskDeg: number;
  earthVisible: boolean;
}

export interface SiteSeasonData {
  kpis: SeasonKpis;
  hourly: HourlyPoint[];
}

export interface LunarSite {
  id: string;
  name: string;
  role: 'candidate' | 'comparison' | string;
  description: string;
  coordinates: SiteCoordinates;
  comparisonTargetId?: string | null;
  comparisonDistanceKm?: number | null;
  horizonMaskDeg?: number[];
  seasons?: Record<SeasonId, SiteSeasonData>;
}

export interface SitesMetadata {
  generatedAt: string;
  defaultSeason: SeasonId;
  seasons?: SeasonMetadata[];
  body: string;
  referenceRadiusKm: number;
  coordinateFrame: string;
  atmosphericRefraction?: boolean;
  observerHeightM?: number;
  ephemerisSource: string;
  topographySource: string;
  horizonMaskResolutionDeg?: number;
}

export interface SitesDataset {
  metadata: SitesMetadata;
  sites: LunarSite[];
}

export type BaseLayerId = 'wac' | 'lola';

export type WmsStatus = 'loading' | 'live' | 'fallback';
