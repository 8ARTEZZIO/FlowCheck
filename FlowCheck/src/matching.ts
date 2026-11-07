import type { Appetite, Area, EvidenceRow, MarketRow, Match, Policy, Profile, Brief } from './types.ts';

export const money = (n: number) => Math.floor(n * 100 + 0.5 + 1e-7) / 100;

export function nearestRank(values: number[], q: number): number {
  if (!values.length || values.some(v => !Number.isFinite(v))) throw new Error('Historical variability data is incomplete.');
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)];
}

export function thresholds(areas: Pick<Area, 'historical_annualized_index_volatility_36m_pct'>[], policy: Policy): Record<Appetite, number> {
  const values = areas.map(a => a.historical_annualized_index_volatility_36m_pct);
  return Object.fromEntries(Object.entries(policy.appetites).map(([key, value]) => [key, nearestRank(values, value.quantile)])) as Record<Appetite, number>;
}

export function joinAreas(evidence: EvidenceRow[], market: Record<string, MarketRow>, policy: Policy): Area[] {
  const codes = new Set(evidence.map(a => a.code));
  if (codes.size !== 33 || evidence.length !== 33 || Object.keys(market).length !== 33) throw new Error('The 33-area source join is incomplete.');
  const rows = evidence.map(e => {
    const m = market[e.code];
    if (!m || !Number.isFinite(m.average_price_gbp) || m.average_price_gbp <= 0 || !Number.isFinite(m.historical_annualized_index_volatility_36m_pct) || m.historical_log_return_observations !== 36) throw new Error(`Market evidence is missing for ${e.borough}.`);
    return { ...e, ...m, risk_band: 'ambitious' as Appetite };
  });
  const caps = thresholds(rows, policy);
  return rows.map(a => ({ ...a, risk_band: a.historical_annualized_index_volatility_36m_pct <= caps.conservative ? 'conservative' : a.historical_annualized_index_volatility_36m_pct <= caps.balanced ? 'balanced' : 'ambitious' }));
}

export function validateProfile(p: Profile): string | null {
  if (!Number.isFinite(p.capital) || p.capital <= 0 || p.capital > 1e12) return 'Enter available capital between £1 and £1 trillion.';
  if (!['conservative', 'balanced', 'ambitious'].includes(p.appetite)) return 'Choose a risk appetite.';
  if (!Number.isFinite(p.works_allowance) || p.works_allowance < 0 || p.works_allowance > 1e8) return 'Enter a works allowance between £0 and £100 million.';
  if (!Number.isFinite(p.reserve_percent) || p.reserve_percent < 0 || p.reserve_percent > 100) return 'Reserve must be between 0% and 100%.';
  if (!Number.isInteger(p.homes) || p.homes < 1 || p.homes > 1000) return 'Choose between 1 and 1,000 homes.';
  if (!['growth', 'vacancy', 'delivery'].includes(p.focus)) return 'Choose an evidence priority.';
  return null;
}

export function matchAreas(areas: Area[], profile: Profile, policy: Policy): Match[] {
  const issue = validateProfile(profile);
  if (issue) throw new Error(issue);
  const cap = thresholds(areas, policy)[profile.appetite];
  return areas.map(area => {
    const required = money(profile.homes * (area.average_price_gbp + profile.works_allowance) * (1 + profile.reserve_percent / 100));
    const budgetFits = profile.capital >= required;
    const riskFits = area.historical_annualized_index_volatility_36m_pct <= cap;
    const reasons = [];
    if (!budgetFits) reasons.push('Above your capital benchmark');
    if (!riskFits) reasons.push('Above your historical-variability cap');
    return { ...area, required_capital: required, budget_fits: budgetFits, risk_fits: riskFits, matches: budgetFits && riskFits, capital_headroom: money(profile.capital - required), budget_gap: money(Math.max(0, required - profile.capital)), exclusion_reasons: reasons };
  }).sort((a, b) => {
    if (a.matches !== b.matches) return a.matches ? -1 : 1;
    if (profile.focus === 'vacancy') return b.longterm_empty_2025_10_06 - a.longterm_empty_2025_10_06 || a.borough.localeCompare(b.borough);
    if (profile.focus === 'delivery') return a.hdt_2025_pct - b.hdt_2025_pct || b.population_change_2024_25_midyear - a.population_change_2024_25_midyear;
    return b.population_change_2024_25_midyear - a.population_change_2024_25_midyear || a.borough.localeCompare(b.borough);
  });
}

const pounds = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v);
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toLocaleString('en-GB')}`;

export function evidenceBrief(area: Match, profile: Profile): Brief {
  const steps: string[] = [];
  if (area.population_change_2024_25_midyear > 0 && area.hdt_2025_pct < 95) steps.push('Compare permissions, starts and completions to locate delivery constraints; verify local household and tenure needs.');
  if (area.internal_net_2024_25_midyear < 0) steps.push('Investigate destinations and reasons for domestic outflows before interpreting international inflows as additional household demand.');
  if (area.longterm_empty_2025_10_06 > 0) steps.push('Check which recorded long-term empty homes are habitable, available and practical to return to use.');
  steps.push('Obtain a property-specific price, survey, tax and works budget before allocating capital.');
  return {
    title: `${area.borough}: area screening brief`,
    summary: `The indicative budget for ${profile.homes} ${profile.homes === 1 ? 'home is' : 'homes is'} ${pounds(area.required_capital)}, using the March 2025 borough-average price and your works and reserve assumptions. Historical annualised HPI variability is ${area.historical_annualized_index_volatility_36m_pct.toFixed(2)}%. Population changed by ${signed(area.population_change_2024_25_midyear)} in the year to mid-2025; the 2025 Housing Delivery Test result is ${area.hdt_2025_pct}% of its three-year requirement. The October 2025 snapshot records ${area.longterm_empty_2025_10_06.toLocaleString('en-GB')} long-term empty dwellings.`,
    next_steps: steps.slice(0, 4),
    caveat: 'This is an area-level historical screen. It does not establish investment returns, property availability, construction costs, recoverable vacancies or a causal migration effect.',
    source_ids: ['market', 'migration', 'hdt', 'vacancy'],
    mode: 'evidence_template',
  };
}
