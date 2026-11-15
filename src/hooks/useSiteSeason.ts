import { useEffect, useState } from 'react';
import type { LunarSite, SeasonMetadata, SiteSeasonData } from '../types/lunar';
import { calculateSiteSeason } from '../utils/dynamicEphemeris';

interface LoadedSeason {
  key: string;
  data: SiteSeasonData;
  source: string;
  sourceDetail?: string;
}

export function useSiteSeason(
  site: LunarSite | undefined,
  seasonId: string,
  startDate: string,
  seasons: SeasonMetadata[],
) {
  const seasonStart = seasons.find((season) => season.id === seasonId)?.timeRange.start.slice(0, 10);
  const storedData = site?.seasons?.[seasonId] ?? (site?.seasons ? Object.values(site.seasons)[0] : undefined);
  const isStoredWindow = Boolean(storedData && seasonStart === startDate);
  const key = `${site?.id ?? ''}:${startDate}`;
  const [loaded, setLoaded] = useState<LoadedSeason | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!site || !startDate || isStoredWindow) {
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    calculateSiteSeason(site, startDate, controller.signal)
      .then(({ data, source, sourceDetail }) => {
        setLoaded({ key, data, source, sourceDetail });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to calculate the selected ephemeris');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [site, startDate, isStoredWindow, key]);

  return {
    data: isStoredWindow ? storedData : loaded?.key === key ? loaded.data : undefined,
    source: isStoredWindow
      ? 'Precomputed dataset'
      : loaded?.key === key
        ? loaded.sourceDetail
          ? `${loaded.source} (JPL unavailable: ${loaded.sourceDetail})`
          : loaded.source
        : undefined,
    loading: Boolean(
      site
      && startDate
      && !isStoredWindow
      && (loading || (!error && loaded?.key !== key)),
    ),
    error,
  };
}
