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
export type Ward = { code: string; name: string; path: string; label: [number, number]; label_clearance: number };
export type WardIndicators = {
  ward_code: string; ward_name: string; borough_code: string; borough: string; neighbourhoods: string;
  low_sales_flag: boolean;
} & Record<WardNumericField, number | null>;
export type WardNumericField = 'lsoa_count' | 'area_km2' | 'pop_2024' | 'pop_change_2023_24_pct' | 'pop_density_per_km2'
  | 'pct_age_0_15' | 'pct_age_16_64' | 'pct_age_65_plus' | 'imd_score' | 'income_score' | 'crime_dep_score'
  | 'housing_barriers_score' | 'living_env_score' | 'pct_lsoas_most_deprived_20pct'
  | 'crime_last12' | 'crime_prev12' | 'crime_per_1000' | 'crime_change_pct'
  | 'sales_2025' | 'median_price_2025' | 'mean_price_2025' | 'median_flat_2025' | 'sales_flat_2025'
  | 'median_terraced_2025' | 'sales_terraced_2025' | 'median_semi_2025' | 'sales_semi_2025'
  | 'median_detached_2025' | 'sales_detached_2025' | 'new_build_share_2025_pct'
  | 'sales_2024' | 'median_price_2024' | 'median_change_2024_25_pct';
export type WardIndicatorDataset = {
  metadata: {
    sources?: { publisher: string; url: string; note: string }[];
    source_audit?: { checked_on: string; status: string; summary: string; limitations: string[] };
    validation?: { status: string; summary?: string };
    [key: string]: unknown;
  };
  wards: Record<string, WardIndicators & { top_crime_group: string | null }>;
};
export type WardGroup = { code: string; name: string; viewBox: string; wards: Ward[] };
export type WardDataset = { metadata: { publisher: string; service_url: string; source_vintage: string; ward_count: number; borough_count: number; [key: string]: unknown }; boroughs: Record<string, WardGroup> };
export type DataBundle = {
  evidence: { boroughs: EvidenceRow[]; sources: Record<string, Source>; method_notes: string[]; retrieved_on: string; london_fdi_context: { net_inward_flow_gbp_billion_2024: number } };
  market: { metadata: Record<string, unknown>; boroughs: Record<string, MarketRow> };
  boundaries: { viewBox: string; fillRule: 'evenodd'; boroughs: Record<string, { name: string; path: string; centroid?: [number, number]; label?: [number, number] }>; metadata: Record<string, unknown> };
  policy: Policy;
  wards: WardDataset;
  wardIndicators: WardIndicatorDataset;
  areas: Area[];
};
export type Brief = { title: string; summary: string; next_steps: string[]; caveat: string; source_ids: string[]; mode: string };
