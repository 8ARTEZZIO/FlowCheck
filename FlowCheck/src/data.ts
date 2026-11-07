import type { DataBundle } from './types.ts';
import { joinAreas } from './matching.ts';

export async function loadData(): Promise<DataBundle> {
  const files = ['evidence', 'market', 'boundaries', 'policy', 'wards'];
  const embedded = (globalThis as typeof globalThis & { __FLOWCHECK_DATA__?: Record<string, unknown> }).__FLOWCHECK_DATA__;
  const [evidence, market, boundaries, policy, wards] = await Promise.all(files.map(async file => {
    if (embedded) {
      if (!(file in embedded)) throw new Error(`The offline demo is missing ${file} data.`);
      return embedded[file];
    }
    const response = await fetch(`/data/${file}.json`);
    if (!response.ok) throw new Error(`Could not load ${file} evidence (${response.status}).`);
    return response.json();
  }));
  const areas = joinAreas(evidence.boroughs, market.boroughs, policy);
  if (Object.keys(boundaries.boroughs).length !== 33 || areas.some(a => !boundaries.boroughs[a.code])) throw new Error('The borough map does not match the evidence.');
  if (Object.keys(wards.boroughs).length !== 33 || areas.some(a => !wards.boroughs[a.code]?.wards?.length)) throw new Error('The district map does not match the borough evidence.');
  return { evidence, market, boundaries, policy, wards, areas };
}
