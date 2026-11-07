export type Appetite = 'conservative' | 'balanced' | 'ambitious';
export type Focus = 'growth' | 'vacancy' | 'delivery';
export type Profile = {
  capital: number;
  appetite: Appetite;
  works_allowance: number;
  reserve_percent: number;
  homes: number;
  focus: Focus;
};
export type EvidenceRow = {
  code: string; borough: string;
  international_net_2024_25_midyear: number;
  internal_net_2024_25_midyear: number;
  population_change_2024_25_midyear: number;
  population_change_pct: number;
  hdt_2025_pct: number; hdt_consequence: string;
  net_additions_fy2024_25: number; net_additions_fy2023_24: number;
  longterm_empty_2025_10_06: number; longterm_empty_2024_10_07: number;
};
export type MarketRow = {
  code: string; name: string; average_price_gbp: number;
  annual_change_pct: number; monthly_change_pct: number;
  historical_annualized_index_volatility_36m_pct: number;
  historical_max_drawdown_36m_pct: number;
  historical_price_change_36m_pct: number;
  price_reference_date: string;
  historical_index_level_observations: number;
  historical_log_return_observations: number;
};
export type Area = EvidenceRow & MarketRow & { risk_band: Appetite };
export type Match = Area & {
  required_capital: number;
  budget_fits: boolean;
  risk_fits: boolean;
  matches: boolean;
  capital_headroom: number;
  budget_gap: number;
  exclusion_reasons: string[];
};
export type Policy = {
  version: string; default_profile: Profile;
  appetites: Record<Appetite, { label: string; min_pct: number; max_pct: number | null; description: string }>;
  risk_method: string; capital_method: string; allowance_note: string;
};
export type Source = { publisher: string; url: string; period: string; note?: string; file?: string; sheet?: string; status?: string };
export type DataBundle = {
  evidence: { boroughs: EvidenceRow[]; sources: Record<string, Source>; method_notes: string[]; retrieved_on: string; london_fdi_context: { net_inward_flow_gbp_billion_2024: number } };
  market: { metadata: Record<string, unknown>; boroughs: Record<string, MarketRow> };
  boundaries: { viewBox: string; fillRule: 'evenodd'; boroughs: Record<string, { name: string; path: string; centroid?: [number, number]; label?: [number, number] }>; metadata: Record<string, unknown> };
  policy: Policy;
  areas: Area[];
};
export type Brief = { title: string; summary: string; next_steps: string[]; caveat: string; source_ids: string[]; mode: string };
