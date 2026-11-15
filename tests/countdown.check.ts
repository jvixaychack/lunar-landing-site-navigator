// @ts-nocheck
// Checks the sunset/Earthset countdown against a brute-force search on the real site data.
// Run: npx tsx tests/countdown.check.ts
import { readFileSync } from 'node:fs';
import { computeCountdown } from '../src/utils/countdown';

const dataset = JSON.parse(readFileSync(new URL('../public/data/sites.json', import.meta.url), 'utf8'));
let checked = 0;
let bad = 0;
for (const site of dataset.sites) {
  for (const [seasonId, season] of Object.entries(site.seasons) as [string, any][]) {
    const hourly = season.hourly;
    for (const body of ['sun', 'earth'] as const) {
      const flag = (p: any) => (body === 'sun' ? p.sunVisible : p.earthVisible);
      for (let index = 0; index < hourly.length; index += 7) {
        const result = computeCountdown(hourly, index, body);
        let j = -1;
        for (let k = index + 1; k < hourly.length; k += 1) {
          if (flag(hourly[k]) !== flag(hourly[index])) { j = k; break; }
        }
        checked += 1;
        const ok =
          result.visibleNow === flag(hourly[index]) &&
          (j === -1
            ? result.hoursToChange === null
            : result.hoursToChange !== null &&
              result.hoursToChange >= j - 1 - index - 1e-9 &&
              result.hoursToChange <= j - index + 1e-9);
        if (!ok) {
          bad += 1;
          if (bad <= 5) console.log('MISMATCH', site.id, seasonId, body, index, result, 'first change at', j);
        }
      }
    }
  }
}
console.log(`${checked} countdowns checked, ${bad} mismatches`);
if (bad > 0) process.exit(1);
console.log('OK');
