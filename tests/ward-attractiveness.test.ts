import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attractivenessColor, joinWardIndicators, scoreWards } from '../src/wardAttractiveness.ts';
import type { WardDataset, WardIndicatorDataset } from '../src/types.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const geometry = read('wards') as WardDataset;
const indicators = read('ward-indicators') as WardIndicatorDataset;
type Indicator = WardIndicatorDataset['wards'][string];
const example = Object.values(indicators.wards).find(row => row.crime_per_1000 !== null && !row.low_sales_flag)!;

function fixture(patches: Partial<Indicator>[]): WardIndicatorDataset {
  return {
    metadata: {},
    wards: Object.fromEntries(patches.map((patch, index) => {
      const code = `test-${index}`;
      return [code, { ...example, ward_code: code, median_price_2025: 500000, pop_change_2023_24_pct: 1,
        crime_per_1000: 100, imd_score: 20, sales_2025: 100, low_sales_flag: false, ...patch }];
    })),
  };
}

test('all 684 indicator rows join by ward and borough code; 20 geometry-only wards remain valid', () => {
  assert.equal(Object.keys(indicators.wards).length, 684);
  assert.doesNotThrow(() => joinWardIndicators(geometry, indicators));
  const wards = Object.values(geometry.boroughs).flatMap(group => group.wards);
  assert.equal(wards.length, 704);
  assert.equal(wards.filter(ward => !indicators.wards[ward.code]).length, 20);
  const unknown = structuredClone(indicators);
  unknown.wards.UNKNOWN = { ...example, ward_code: 'UNKNOWN' };
  assert.throws(() => joinWardIndicators(geometry, unknown));
  const mismatched = structuredClone(indicators);
  mismatched.wards[example.ward_code].borough_code = 'WRONG-BOROUGH';
  assert.throws(() => joinWardIndicators(geometry, mismatched));
});

test('the published indicator snapshot preserves every CSV cell, including missing values and flags', () => {
  const script = `
import csv, json, math, sys
with open(sys.argv[1], newline='', encoding='utf-8') as source:
    rows = list(csv.DictReader(source))
with open(sys.argv[2], encoding='utf-8') as snapshot:
    published = json.load(snapshot)['wards']
assert len(rows) == len(published) == 684
text_columns = {'borough', 'borough_code', 'ward_name', 'ward_code', 'neighbourhoods', 'top_crime_group'}
for raw in rows:
    row = published[raw['ward_code']]
    assert set(row) == set(raw), raw['ward_code']
    for column, value in raw.items():
        actual = row[column]
        context = (raw['ward_code'], column, value, actual)
        if value == '':
            assert actual is None, context
        elif column in text_columns:
            assert actual == value, context
        elif column == 'low_sales_flag':
            assert type(actual) is bool and actual == (value == 'True'), context
        else:
            assert type(actual) in (int, float) and math.isfinite(actual) and actual == float(value), context
`;
  execFileSync(process.env.FLOWCHECK_PYTHON || 'python3', ['-c', script,
    fileURLToPath(new URL('../datasets/london-wards/london_wards.csv', import.meta.url)),
    fileURLToPath(new URL('../public/data/ward-indicators.json', import.meta.url)),
  ]);
});

test('the four favorable directions produce an equally weighted 0, 50, 100 scale', () => {
  const rows = fixture([
    { median_price_2025: 900000, pop_change_2023_24_pct: -1, crime_per_1000: 200, imd_score: 40 },
    {},
    { median_price_2025: 200000, pop_change_2023_24_pct: 3, crime_per_1000: 10, imd_score: 5 },
  ]);
  const scores = scoreWards(rows);
  assert.deepEqual(Object.values(scores).map(row => row.score), [0, 50, 100]);
  for (const result of Object.values(scores)) {
    assert.equal(result.components.length, 4);
    assert.equal(result.reason, null);
    assert.ok(result.components.every(component => component.value === result.score));
  }
});

test('each indicator independently improves attractiveness with a 25 percent weight', () => {
  const cases: [keyof Indicator, number, number, number][] = [
    ['median_price_2025', 900000, 500000, 200000],
    ['pop_change_2023_24_pct', -1, 1, 3],
    ['crime_per_1000', 200, 100, 10],
    ['imd_score', 40, 20, 5],
  ];
  for (const [key, worst, middle, best] of cases) {
    const scores = scoreWards(fixture([{ [key]: worst }, { [key]: middle }, { [key]: best }]));
    assert.deepEqual(Object.values(scores).map(row => row.score), [37.5, 50, 62.5], String(key));
  }
});

test('tied values and a single eligible ward have neutral percentiles', () => {
  for (const rows of [fixture([{}]), fixture([{}, {}, {}])]) {
    assert.ok(Object.values(scoreWards(rows)).every(row => row.score === 50));
  }
});

test('missing, nonfinite, invalid and low-sales inputs are unscored and cannot affect peers', () => {
  const patches: Partial<Indicator>[] = [
    { median_price_2025: null }, { median_price_2025: 0 }, { median_price_2025: Infinity },
    { pop_change_2023_24_pct: null }, { pop_change_2023_24_pct: NaN },
    { crime_per_1000: null }, { crime_per_1000: -1 }, { crime_per_1000: Infinity },
    { imd_score: null }, { imd_score: -1 }, { imd_score: NaN },
    { sales_2025: 19 }, { sales_2025: null }, { low_sales_flag: true },
  ];
  const scores = scoreWards(fixture([{}, ...patches]));
  assert.equal(scores['test-0'].score, 50);
  for (let index = 1; index <= patches.length; index++) {
    assert.equal(scores[`test-${index}`].score, null);
    assert.ok(scores[`test-${index}`].reason, `missing explanation for fixture ${index}`);
  }
});

test('genuine zero crime, zero deprivation and zero population change remain valid', () => {
  const result = scoreWards(fixture([{ crime_per_1000: 0, imd_score: 0, pop_change_2023_24_pct: 0, sales_2025: 20 }]))['test-0'];
  assert.equal(result.score, 50);
  assert.equal(result.reason, null);
});

test('London-wide scores survive row reordering and do not mutate source data', () => {
  const before = JSON.stringify(indicators);
  const forward = scoreWards(indicators);
  const reversed = scoreWards({ ...indicators, wards: Object.fromEntries(Object.entries(indicators.wards).reverse()) });
  assert.deepEqual(forward, reversed);
  assert.equal(JSON.stringify(indicators), before);
  // Portsoken's low sales count overlaps the five City wards with missing crime.
  assert.equal(Object.values(forward).filter(result => result.score !== null).length, 679);
  assert.ok(Object.values(forward).filter(result => result.score === null).every(result => result.reason));
});

test('the continuous green scale has many shades, distinct missing data and bounded endpoints', () => {
  const shades = Array.from({ length: 101 }, (_, score) => attractivenessColor(score));
  assert.ok(new Set(shades).size > 50);
  assert.ok(shades.every(color => /^#[a-f\d]{6}$/i.test(color)));
  assert.equal(attractivenessColor(null), '#dce1df');
  assert.ok(!shades.includes(attractivenessColor(null)));
  assert.equal(attractivenessColor(-10), attractivenessColor(0));
  assert.equal(attractivenessColor(110), attractivenessColor(100));
});
