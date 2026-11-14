export interface SiteCoordinates {
  latitudeDeg: number;
  longitudeDeg: number;
  elevationM: number;
  observerHeightM?: number;
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
}

export interface SitesMetadata {
  generatedAt: string;
  defaultSeason: string;
  body: string;
  referenceRadiusKm: number;
  coordinateFrame: string;
  ephemerisSource: string;
  topographySource: string;
}

export interface SitesDataset {
  metadata: SitesMetadata;
  sites: LunarSite[];
}

export type BaseLayerId = 'wac' | 'lola';

export type WmsStatus = 'loading' | 'live' | 'fallback';
