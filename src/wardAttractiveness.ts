import type { WardDataset, WardIndicatorDataset, WardIndicators } from './types.ts';

export const ATTRACTIVENESS_FACTORS = [
  { key: 'median_price_2025', label: 'Affordability', lower: true },
  { key: 'pop_change_2023_24_pct', label: 'Population growth', lower: false },
  { key: 'crime_per_1000', label: 'Lower recorded crime', lower: true },
  { key: 'imd_score', label: 'Lower deprivation', lower: true },
] as const;

export type WardAttractiveness = {
  score: number | null;
  components: { key: string; label: string; value: number }[];
  reason: string | null;
};

function unavailableReason(row: WardIndicators): string | null {
  if (ATTRACTIVENESS_FACTORS.some(factor => row[factor.key] === null || !Number.isFinite(row[factor.key]))) {
    return 'Not scored: one or more indicators are unavailable.';
  }
  if (row.median_price_2025! <= 0 || row.crime_per_1000! < 0 || row.imd_score! < 0) return 'Not scored: invalid indicator values.';
  if (row.low_sales_flag || row.sales_2025 === null || !Number.isFinite(row.sales_2025) || row.sales_2025 < 20) {
    return 'Not scored: fewer than 20 reliable sales in 2025.';
  }
  return null;
}

/** One fixed London-wide reference sample, independent of borough selection or budget. */
export function scoreWards(dataset: WardIndicatorDataset): Record<string, WardAttractiveness> {
  const rows = Object.values(dataset.wards);
  const reliable = rows.filter(row => unavailableReason(row) === null);
  const distributions = ATTRACTIVENESS_FACTORS.map(factor => reliable.map(row => row[factor.key]!).sort((a, b) => a - b));
  return Object.fromEntries(rows.map(row => {
    const reason = unavailableReason(row);
    if (reason) return [row.ward_code, { score: null, components: [], reason }];
    const components = ATTRACTIVENESS_FACTORS.map((factor, i) => {
      const values = distributions[i];
      const value = row[factor.key]!;
      const below = values.filter(n => n < value).length;
      const equal = values.filter(n => n === value).length;
      const percentile = values.length <= 1 ? 50 : 100 * (below + (equal - 1) / 2) / (values.length - 1);
      return { key: factor.key, label: factor.label, value: factor.lower ? 100 - percentile : percentile };
    });
    return [row.ward_code, { score: components.reduce((sum, factor) => sum + factor.value, 0) / components.length, components, reason: null }];
  }));
}

/** Continuous sequential green palette; selection changes the outline, never the score fill. */
export function attractivenessColor(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return '#dce1df';
  const stops = ['#edf8e9', '#d9f0ce', '#addd8e', '#78c679', '#41ab5d', '#238443', '#005a32'];
  const position = Math.max(0, Math.min(100, score)) / 100 * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const blend = position - index;
  const rgb = [1, 3, 5].map(offset => {
    const a = parseInt(stops[index].slice(offset, offset + 2), 16);
    const b = parseInt(stops[index + 1].slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * blend).toString(16).padStart(2, '0');
  });
  return `#${rgb.join('')}`;
}

export function joinWardIndicators(geometry: WardDataset, indicators: WardIndicatorDataset): void {
  const parents = new Map(Object.values(geometry.boroughs).flatMap(group => group.wards.map(ward => [ward.code, group.code] as const)));
  if (!Object.keys(indicators.wards).length) throw new Error('District indicators are missing.');
  for (const [code, row] of Object.entries(indicators.wards)) {
    if (row.ward_code !== code || parents.get(code) !== row.borough_code) throw new Error(`District indicators do not match the map: ${code}.`);
  }
}
