import type { DataBundle } from './types.ts';
import { joinAreas } from './matching.ts';

export async function loadData(): Promise<DataBundle> {
  const files = ['evidence', 'market', 'boundaries', 'policy'];
  const [evidence, market, boundaries, policy] = await Promise.all(files.map(async file => {
    const response = await fetch(`/data/${file}.json`);
    if (!response.ok) throw new Error(`Could not load ${file} evidence (${response.status}).`);
    return response.json();
  }));
  const areas = joinAreas(evidence.boroughs, market.boroughs, policy);
  if (Object.keys(boundaries.boroughs).length !== 33 || areas.some(a => !boundaries.boroughs[a.code])) throw new Error('The borough map does not match the evidence.');
  return { evidence, market, boundaries, policy, areas };
}
