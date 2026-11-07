import { useEffect, useMemo, useRef, useState } from 'react';
import type { WardGroup, WardIndicatorDataset, WardIndicators } from './types.ts';
import { attractivenessColor, scoreWards } from './wardAttractiveness.ts';

type Props = { group: WardGroup; indicators: WardIndicatorDataset; onBack: () => void };
const number = (n: number | null, digits = 0) => n === null ? 'Not available' : n.toLocaleString('en-GB', { maximumFractionDigits: digits });
const money = (n: number | null) => n === null ? 'Not available' : `£${number(n)}`;
const percent = (n: number | null) => n === null ? 'Not available' : `${n > 0 ? '+' : ''}${number(n, 2)}%`;

function WardLegend() {
  return <div className="ward-legend" aria-label="Attractiveness scale: light green is lower, dark green is higher; grey is not scored">
    <div><strong>Attractiveness</strong><span>Lower <i className="ward-gradient"/> Higher</span></div>
    <span><i className="ward-unscored-key"/>Not scored</span>
  </div>;
}

function ExtraIndicators({ row }: { row: WardIndicatorDataset['wards'][string] }) {
  const metrics: [string, string][] = [
    ['Area', row.area_km2 === null ? 'Not available' : `${number(row.area_km2, 3)} km²`],
    ['Population density', row.pop_density_per_km2 === null ? 'Not available' : `${number(row.pop_density_per_km2)} / km²`],
    ['Age 0–15 / 16–64 / 65+ (mid-2024)', [row.pct_age_0_15, row.pct_age_16_64, row.pct_age_65_plus].map(n => n === null ? 'N/A' : `${number(n, 1)}%`).join(' / ')],
    ['2025 mean sale price', money(row.mean_price_2025)], ['2024 median sale price', money(row.median_price_2024)],
    ['2024 sales', number(row.sales_2024)], ['New-build share of 2025 sales', row.new_build_share_2025_pct === null ? 'Not available' : `${number(row.new_build_share_2025_pct, 1)}%`],
    ['Previous 12 months’ offences', number(row.crime_prev12)], ['Most common recorded crime', row.top_crime_group || 'Not available'],
    ['Income deprivation score', number(row.income_score, 3)], ['Crime deprivation score', number(row.crime_dep_score, 3)],
    ['Housing barriers score', number(row.housing_barriers_score, 3)], ['Living environment score', number(row.living_env_score, 3)],
    ['Small areas in England’s most deprived 20%', row.pct_lsoas_most_deprived_20pct === null ? 'Not available' : `${number(row.pct_lsoas_most_deprived_20pct, 1)}%`],
    ['Assigned small areas (LSOAs)', number(row.lsoa_count)],
  ];
  return <details className="ward-more"><summary>More district data</summary>
    <h4>2025 sale medians by property type</h4>
    <div className="ward-property-types">{(['flat', 'terraced', 'semi', 'detached'] as const).map(type => <div key={type}>
      <span>{type === 'semi' ? 'Semi-detached' : type[0].toUpperCase() + type.slice(1)}</span>
      <strong>{money(row[`median_${type}_2025`])}</strong><small>{number(row[`sales_${type}_2025`])} sales</small>
    </div>)}</div>
    <p>Property-type samples can be small even when the overall ward has 20 or more sales.</p>
    <dl>{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </details>;
}

function WardMetrics({ row }: { row: WardIndicators }) {
  return <dl className="ward-metrics">
    <div><dt>Median sale price</dt><dd>{money(row.median_price_2025)}</dd><small>{number(row.sales_2025)} sales · 2025</small></div>
    <div><dt>Sale median change</dt><dd>{percent(row.median_change_2024_25_pct)}</dd><small>2024 → 2025 · sales mix varies</small></div>
    <div><dt>Population</dt><dd>{number(row.pop_2024)}</dd><small>Residents · mid-2024</small></div>
    <div><dt>Population change</dt><dd>{percent(row.pop_change_2023_24_pct)}</dd><small>Mid-2023 → mid-2024</small></div>
    <div><dt>Recorded crime / 1,000</dt><dd>{number(row.crime_per_1000, 1)}</dd><small>Nov 2025–Oct 2026 · residents</small></div>
    <div><dt>Recorded offences</dt><dd>{number(row.crime_last12)}</dd><small>{percent(row.crime_change_pct)} year on year</small></div>
    <div><dt>Deprivation (IMD)</dt><dd>{number(row.imd_score, 2)}</dd><small>IoD 2025 · higher = more deprived</small></div>
  </dl>;
}

export function WardMap({ group, indicators, onBack }: Props) {
  const scores = useMemo(() => scoreWards(indicators), [indicators]);
  const [selectedCode, setSelectedCode] = useState(() => [...group.wards].sort((a, b) => (scores[b.code]?.score ?? -1) - (scores[a.code]?.score ?? -1))[0]?.code || '');
  const [hoveredCode, setHoveredCode] = useState('');
  const backButton = useRef<HTMLButtonElement>(null);
  const selected = group.wards.find(ward => ward.code === selectedCode);
  const highlighted = group.wards.find(ward => ward.code === (hoveredCode || selectedCode));
  const row = indicators.wards[selectedCode];
  const rating = scores[selectedCode];
  const scoredCount = Object.values(scores).filter(score => score.score !== null).length;
  useEffect(() => { backButton.current?.focus({ preventScroll: true }); }, []);

  function selectWard(code: string) {
    setSelectedCode(code);
    setHoveredCode('');
  }
  function scoreLabel(code: string) {
    const score = scores[code]?.score;
    return score === null || score === undefined ? 'Not scored' : `Attractiveness ${score.toFixed(1)} / 100`;
  }

  return <div className="ward-explorer" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onBack(); } }}>
    <div className="ward-toolbar">
      <button ref={backButton} className="ward-back" onClick={onBack} aria-label="Back to London borough map"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg>Back to London</button>
      <span>{group.wards.length} districts <small>(wards)</small></span>
    </div>
    <p className="ward-map-intro">Darker green = higher attractiveness. Select a district to compare its evidence.</p>
    <div className="ward-map-legend"><WardLegend/></div>
    <div className="map-stage ward-stage">
      <div className="map-grid"/>
      <svg className="borough-map ward-map" viewBox={group.viewBox} role="group" aria-label={`${group.name} district attractiveness map. Darker green indicates a higher score. Select a ward to see its data.`}>
        {group.wards.map((ward, index) => {
          const score = scores[ward.code]?.score ?? null;
          return <g key={ward.code}>
            <path className={`ward-boundary ${ward.code === selectedCode ? 'selected' : ''} ${ward.code === hoveredCode ? 'hovered' : ''}`} style={{ fill: attractivenessColor(score) }} data-ward-code={ward.code} data-score={score === null ? undefined : score.toFixed(2)} d={ward.path} fillRule="evenodd" role="button" tabIndex={0} aria-label={`${ward.name}, ${scoreLabel(ward.code)}, district ${index + 1} in ${group.name}`} aria-pressed={ward.code === selectedCode} onClick={() => selectWard(ward.code)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectWard(ward.code); } }} onMouseEnter={() => setHoveredCode(ward.code)} onMouseLeave={() => setHoveredCode('')} onFocus={() => setHoveredCode(ward.code)} onBlur={() => setHoveredCode('')}><title>{`${index + 1}. ${ward.name} · ${scoreLabel(ward.code)} · ${ward.code}`}</title></path>
            <text x={ward.label[0]} y={ward.label[1]} textAnchor="middle" dominantBaseline="middle" className={`ward-label ${score !== null && score >= 60 ? 'on-dark' : ''}`} pointerEvents="none">{ward.label_clearance >= 24 && ward.name.length <= 21 && group.code !== 'E09000001' ? ward.name : index + 1}</text>
          </g>;
        })}
      </svg>
      {highlighted && <div className="map-tooltip ward-tooltip" aria-live="polite"><strong>{highlighted.name}</strong><span>{scoreLabel(highlighted.code)}</span><small>{highlighted.code === selectedCode ? 'Selected district · outlined on map' : 'Click to inspect district data'}</small></div>}
    </div>
    <div className="ward-selector">
      <label htmlFor="ward-select">Explore a district <span>Official electoral wards</span></label>
      <select id="ward-select" aria-label={`Choose a district in ${group.name}`} value={selectedCode} onChange={event => selectWard(event.target.value)}><option value="">Choose a district on the map or here…</option>{group.wards.map((ward, index) => <option key={ward.code} value={ward.code}>{index + 1}. {ward.name} · {scoreLabel(ward.code)}</option>)}</select>
      <section className="ward-selection" aria-label="Selected district evidence" aria-live="polite">
        {selected ? <>
          <div className="ward-selection-heading"><div><h3>{selected.name}</h3><span>{selected.code} · {group.name}</span></div>
            <div className="ward-score" style={{ borderColor: attractivenessColor(rating?.score ?? null) }}><strong>{rating?.score === null || rating?.score === undefined ? '—' : rating.score.toFixed(1)}<small> / 100</small></strong><span>Attractiveness</span></div>
          </div>
          {rating?.reason && <p className="ward-data-note">{rating.reason}{row?.crime_per_1000 === null && group.code === 'E09000001' ? ' City of London Police figures are not included in the Met dataset.' : ''}</p>}
          {row ? <>
            {row.neighbourhoods && <p className="ward-neighbourhoods"><b>Overlapping neighbourhoods</b>{row.neighbourhoods.split(';').map(name => name.trim()).join(' · ')}</p>}
            {row.low_sales_flag && <p className="ward-data-note">Small sales sample: {number(row.sales_2025)} sales in 2025. Treat sale medians and changes as unreliable.</p>}
            <WardMetrics row={row}/>
            {rating && rating.score !== null && <div className="ward-score-breakdown"><h4>What shapes this score <span>25% each · higher is more favourable</span></h4>{rating.components.map(factor => <div key={factor.key}><span>{factor.label}</span><meter min="0" max="100" value={factor.value} aria-label={`${factor.label} favourable percentile`}/><strong>{factor.value.toFixed(0)}</strong></div>)}</div>}
            <ExtraIndicators row={row}/>
          </> : <p className="ward-data-note">No district indicators available. This ward has a boundary but no assigned small-area data in the snapshot; no borough averages have been substituted.</p>}
        </> : <p>Select a district to view population, housing, crime and deprivation data.</p>}
      </section>
      <details className="ward-method"><summary>How attractiveness is graded</summary>
        <p>A relative screening score across {scoredCount} London wards with complete indicators and at least 20 sales in 2025. Lower sale prices, higher population growth, lower recorded crime per resident and lower deprivation each contribute 25%.</p>
        <p>Each indicator is converted to a London-wide favourable percentile from 0 to 100; tied values share their average rank. The score is the mean of these four percentiles. Colours use a continuous green scale. The comparison group stays fixed when you change borough or budget. Grey wards are unscored.</p>
        <p>These are chosen screening preferences, not an official attractiveness rating or a return forecast. Ward scores do not change borough capital or appetite matches.</p>
      </details>
      <p className="ward-source-note">Source: london-wards · population mid-2024 · Land Registry sales 2025 · Met crime Nov 2025–Oct 2026 · IoD 2025. Whole-LSOA best-fit estimates; boundaries are for display. Central crime rates reflect visitors and workers as well as residents, and are not personal-risk measures. Sale medians reflect the mix of properties sold.</p>
    </div>
  </div>;
}
