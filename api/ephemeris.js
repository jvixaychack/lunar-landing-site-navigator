const HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

function parseSeries(resultText, targetId) {
  const rows = [];
  let readingRows = false;
  for (const line of resultText.split(/\r?\n/)) {
    const row = line.trim();
    if (row === '$$SOE') {
      readingRows = true;
      continue;
    }
    if (row === '$$EOE') break;
    if (!readingRows || !row) continue;

    const columns = line.split(',');
    if (columns.length < 5) continue;
    const azimuth = Number(columns[3]);
    const elevation = Number(columns[4]);
    if (Number.isFinite(azimuth) && Number.isFinite(elevation)) {
      rows.push({ azimuth: ((azimuth % 360) + 360) % 360, elevation });
    }
  }
  if (rows.length !== 720) {
    throw new Error(`Expected 720 Horizons rows for target ${targetId}; received ${rows.length}`);
  }
  return rows;
}

async function fetchTarget(targetId, latDeg, lonDeg, altKm, startDate, stopDate) {
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: targetId,
    OBJ_DATA: 'NO',
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'OBSERVER',
    CENTER: 'coord@301',
    COORD_TYPE: 'GEODETIC',
    SITE_COORD: `'${lonDeg},${latDeg},${altKm}'`,
    START_TIME: `'${startDate} 00:00'`,
    STOP_TIME: `'${stopDate} 23:00'`,
    STEP_SIZE: "'1 h'",
    QUANTITIES: '4',
    APPARENT: 'AIRLESS',
    CSV_FORMAT: 'YES',
  });
  const response = await fetch(`${HORIZONS_API_URL}?${params}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`JPL Horizons returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (typeof payload.result !== 'string' || !payload.result) {
    throw new Error(`JPL Horizons returned no data for target ${targetId}`);
  }
  return parseSeries(payload.result, targetId);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const { latDeg, lonDeg, altKm, startDate } = request.query;
  const latitude = Number(latDeg);
  const longitude = Number(lonDeg);
  const altitude = Number(altKm);
  const parsedStart = typeof startDate === 'string' ? new Date(`${startDate}T00:00:00Z`) : null;
  const isValidDate = parsedStart !== null
    && !Number.isNaN(parsedStart.getTime())
    && parsedStart.toISOString().slice(0, 10) === startDate;

  if (
    !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < 0 || longitude >= 360
    || !Number.isFinite(altitude) || altitude < -10 || altitude > 30
    || !isValidDate
  ) {
    return response.status(400).json({ error: 'Invalid site coordinates, altitude, or start date' });
  }

  const stop = new Date(parsedStart.getTime() + 29 * 86_400_000);
  const stopDate = stop.toISOString().slice(0, 10);
  try {
    const [sun, earth] = await Promise.all([
      fetchTarget('10', latitude, longitude, altitude, startDate, stopDate),
      fetchTarget('399', latitude, longitude, altitude, startDate, stopDate),
    ]);
    response.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return response.status(200).json({
      sunAzimuthDeg: sun.map((row) => row.azimuth),
      sunElevationDeg: sun.map((row) => row.elevation),
      earthAzimuthDeg: earth.map((row) => row.azimuth),
      earthElevationDeg: earth.map((row) => row.elevation),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JPL Horizons request failed';
    console.error(message);
    return response.status(502).json({ error: message });
  }
}
