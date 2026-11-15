// Checks the browser horizon-mask port against the masks the Python pipeline
// precomputed for the six built-in sites.
// Run (after `python scripts/build_dem_tiles.py`):  npx tsx tests/horizonMask.check.ts
// @ts-nocheck
import { readFileSync } from 'node:fs';
import { createTileLoader, computeHorizonMask } from '../src/utils/horizonMask';

const demDir = new URL('../public/data/dem/', import.meta.url);
const loader = createTileLoader(async (name) => {
  const buf = readFileSync(new URL(name, demDir));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
});

const dataset = JSON.parse(readFileSync(new URL('../public/data/sites.json', import.meta.url), 'utf8'));
let worst = 0;
for (const site of dataset.sites) {
  const { latitudeDeg, longitudeDeg, elevationM } = site.coordinates;
  const t0 = performance.now();
  const result = await computeHorizonMask(latitudeDeg, longitudeDeg, loader);
  const ms = performance.now() - t0;
  let maxDiff = 0;
  site.horizonMaskDeg.forEach((expected: number, i: number) => {
    maxDiff = Math.max(maxDiff, Math.abs(expected - result.mask[i]));
  });
  worst = Math.max(worst, maxDiff);
  console.log(
    `${site.id.padEnd(22)} max |mask diff| = ${maxDiff.toExponential(2)} deg, ` +
      `surface ${result.surfaceHeightM} m (stored ${elevationM}), ${result.tilesLoaded} tiles, ${ms.toFixed(0)} ms`,
  );
}
if (worst > 1e-3) {
  console.error(`FAIL: worst difference ${worst} deg`);
  process.exit(1);
}
console.log('OK');
