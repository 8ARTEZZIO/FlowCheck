import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { WardDataset } from '../src/types.ts';

const wards = JSON.parse(readFileSync(new URL('../public/data/wards.json', import.meta.url), 'utf8')) as WardDataset;
const evidence = JSON.parse(readFileSync(new URL('../public/data/evidence.json', import.meta.url), 'utf8')) as { boroughs: { code: string }[] };

test('official ward parent codes cover every borough exactly once, including City of London', () => {
  assert.deepEqual(Object.keys(wards.boroughs).sort(), evidence.boroughs.map(area => area.code).sort());
  const all = Object.values(wards.boroughs).flatMap(group => group.wards);
  assert.equal(all.length, 704);
  assert.equal(new Set(all.map(ward => ward.code)).size, all.length);
  assert.equal(wards.boroughs.E09000001.wards.length, 25);
  assert.ok(wards.boroughs.E09000032.wards.some(ward => ward.name === 'West Putney'));
});

test('every district has drawable geometry and a label inside its borough viewport', () => {
  for (const [code, group] of Object.entries(wards.boroughs)) {
    assert.equal(group.code, code);
    assert.ok(group.wards.length > 0);
    for (const ward of group.wards) {
      assert.ok(ward.name.length > 0 && ward.path.startsWith('M') && ward.path.endsWith(' Z'));
      assert.ok(ward.label[0] > 0 && ward.label[0] < 900 && ward.label[1] > 0 && ward.label[1] < 650);
      assert.ok(ward.label_clearance > 0);
      const points = [...ward.path.matchAll(/[ML]([\d.-]+),([\d.-]+)/g)];
      assert.ok(points.length >= 4);
      assert.ok(points.every(point => Number(point[1]) >= 0 && Number(point[1]) <= 900 && Number(point[2]) >= 0 && Number(point[2]) <= 650));
    }
  }
});
