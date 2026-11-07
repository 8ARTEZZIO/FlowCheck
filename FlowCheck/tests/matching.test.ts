import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { joinAreas, matchAreas, thresholds, evidenceBrief, validateProfile } from '../src/matching.ts';
import type { Policy, Profile, EvidenceRow, MarketRow } from '../src/types.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const evidence = read('evidence') as { boroughs: EvidenceRow[] };
const market = read('market') as { boroughs: Record<string, MarketRow> };
const policy = read('policy') as Policy;
const areas = joinAreas(evidence.boroughs, market.boroughs, policy);
const base: Profile = { ...policy.default_profile, capital: 2_000_000 };

test('every official area has a unique, complete price and evidence join', () => {
  assert.equal(areas.length, 33);
  assert.equal(new Set(areas.map(a => a.code)).size, 33);
  assert.equal(areas.reduce((n, a) => n + a.population_change_2024_25_midyear, 0), -26737);
  assert.equal(areas.reduce((n, a) => n + a.longterm_empty_2025_10_06, 0), 47287);
});

test('appetite uses the fixed historical variability caps', () => {
  assert.deepEqual(thresholds(areas, policy), { conservative: 5, balanced: 15, ambitious: 17.013 });
  assert.deepEqual(['conservative', 'balanced', 'ambitious'].map(appetite => matchAreas(areas, { ...base, appetite: appetite as Profile['appetite'] }, policy).filter(a => a.risk_fits).length), [16, 16, 1]);
  assert.equal(areas.find(a => a.historical_annualized_index_volatility_36m_pct === 17.013)?.risk_band, 'ambitious');
});

test('cash budget includes the declared works allowance, units and reserve', () => {
  const result = matchAreas(areas, base, policy).find(a => a.code === 'E09000016')!;
  assert.equal(result.average_price_gbp, 449753);
  assert.equal(result.required_capital, 549728.30);
  const twoHomes = matchAreas(areas, { ...base, homes: 2 }, policy).find(a => a.code === result.code)!;
  assert.equal(twoHomes.required_capital, 1099456.60);
});

test('a budget on the penny boundary fits; one penny below fails', () => {
  assert.equal(matchAreas(areas, { ...base, capital: 549728.30, appetite: 'conservative' }, policy).find(a => a.code === 'E09000016')!.matches, true);
  const excluded = matchAreas(areas, { ...base, capital: 549728.29, appetite: 'conservative' }, policy).find(a => a.code === 'E09000016')!;
  assert.equal(excluded.matches, false);
  assert.equal(excluded.budget_gap, .01);
});

test('a capital amount below every borough reference produces zero matches', () => {
  const rows = matchAreas(areas, { ...base, capital: 250000, appetite: 'ambitious' }, policy);
  assert.equal(rows.filter(a => a.matches).length, 0);
  assert.ok(rows.every(a => !a.budget_fits || !a.risk_fits));
});

test('larger capital increases matches within the same appetite band', () => {
  const low = matchAreas(areas, { ...base, capital: 600000, appetite: 'balanced' }, policy).filter(a => a.matches).map(a => a.code);
  const high = new Set(matchAreas(areas, { ...base, capital: 900000, appetite: 'balanced' }, policy).filter(a => a.matches).map(a => a.code));
  assert.ok(low.every(code => high.has(code)));
});

test('priority changes ordering without changing eligibility', () => {
  const growth = matchAreas(areas, { ...base, appetite: 'balanced', focus: 'growth' }, policy);
  const vacancy = matchAreas(areas, { ...base, appetite: 'balanced', focus: 'vacancy' }, policy);
  assert.notEqual(growth[0].borough, vacancy[0].borough);
  assert.deepEqual(growth.map(a => a.code).sort(), vacancy.map(a => a.code).sort());
});

test('missing prices and incomplete volatility fail closed', () => {
  const broken = structuredClone(market.boroughs);
  delete broken.E09000016;
  assert.throws(() => joinAreas(evidence.boroughs, broken, policy), /incomplete/);
  const short = structuredClone(market.boroughs);
  short.E09000016.historical_log_return_observations = 35;
  assert.throws(() => joinAreas(evidence.boroughs, short, policy), /missing/);
});

test('invalid profiles do not produce a plausible shortlist', () => {
  for (const patch of [{ capital: NaN }, { capital: -1 }, { capital: Infinity }, { homes: 1.5 }, { homes: 0 }, { reserve_percent: -1 }, { works_allowance: -1 }]) {
    assert.ok(validateProfile({ ...base, ...patch }));
    assert.throws(() => matchAreas(areas, { ...base, ...patch }, policy));
  }
});

test('briefs preserve dates, data limitations and source identifiers', () => {
  const area = matchAreas(areas, base, policy).find(a => a.code === 'E09000016')!;
  const brief = evidenceBrief(area, base);
  assert.match(brief.summary, /March 2025/);
  assert.match(brief.summary, /£549,728\.30/);
  assert.match(brief.summary, /3,745/);
  assert.equal(brief.mode, 'evidence_template');
  assert.deepEqual(brief.source_ids, ['market', 'migration', 'hdt', 'vacancy']);
});

test('Python API matching agrees with the client across cash, appetite and focus cases', () => {
  const profiles: Profile[] = [base, { ...base, capital: 500000, appetite: 'conservative' }, { ...base, appetite: 'ambitious', focus: 'vacancy', homes: 2 }, { ...base, capital: 750000, focus: 'delivery', reserve_percent: 0, works_allowance: 0 }];
  const script = "import json,sys; from app.core import Profile,join_areas,match_areas; print(json.dumps([[{'code':a['code'],'matches':a['matches'],'required_capital':a['required_capital']} for a in match_areas(join_areas(),Profile.model_validate(p))] for p in json.loads(sys.argv[1])]))";
  const backend = fileURLToPath(new URL('../backend', import.meta.url));
  const python = JSON.parse(execFileSync(process.env.FLOWCHECK_PYTHON || 'python3', ['-c', script, JSON.stringify(profiles)], { cwd: backend, encoding: 'utf8' }));
  const client = profiles.map(p => matchAreas(areas, p, policy).map(a => ({ code: a.code, matches: a.matches, required_capital: a.required_capital })));
  assert.deepEqual(client, python);
});
