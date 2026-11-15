// @ts-nocheck
// Checks the Good / Marginal / Poor ratings against an independent Python calculation
// of the same rules on the precomputed data. Run: npx tsx tests/viability.check.ts
import { readFileSync } from 'node:fs';
import { assessViability } from '../src/utils/viability';

const expected: Record<string, [string, string]> = {"shackleton-rim|south-pole-summer": ["good", "marginal"], "shackleton-rim|equinox": ["good", "marginal"], "shackleton-rim|south-pole-winter": ["marginal", "marginal"], "malapert-massif|south-pole-summer": ["marginal", "good"], "malapert-massif|equinox": ["marginal", "good"], "malapert-massif|south-pole-winter": ["marginal", "good"], "nobile-rim-1|south-pole-summer": ["good", "marginal"], "nobile-rim-1|equinox": ["marginal", "good"], "nobile-rim-1|south-pole-winter": ["marginal", "good"], "connecting-ridge|south-pole-summer": ["good", "marginal"], "connecting-ridge|equinox": ["good", "marginal"], "connecting-ridge|south-pole-winter": ["marginal", "marginal"], "peak-near-shackleton|south-pole-summer": ["good", "marginal"], "peak-near-shackleton|equinox": ["good", "marginal"], "peak-near-shackleton|south-pole-winter": ["marginal", "marginal"], "deep-crater-floor|south-pole-summer": ["poor", "poor"], "deep-crater-floor|equinox": ["poor", "poor"], "deep-crater-floor|south-pole-winter": ["poor", "poor"]};

const dataset = JSON.parse(readFileSync(new URL('../public/data/sites.json', import.meta.url), 'utf8'));
let checked = 0;
let bad = 0;
for (const site of dataset.sites) {
  for (const [seasonId, season] of Object.entries(site.seasons) as [string, any][]) {
    const want = expected[`${site.id}|${seasonId}`];
    const got = assessViability(season.hourly);
    checked += 1;
    if (!want || got.power.rating !== want[0] || got.comms.rating !== want[1]) {
      bad += 1;
      console.log('MISMATCH', site.id, seasonId, 'expected', want, 'got', got.power.rating, got.comms.rating);
    }
  }
}
console.log(`${checked} site/season combinations checked, ${bad} mismatches`);
if (bad > 0) process.exit(1);
console.log('OK');
