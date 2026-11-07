import type { WardIndicatorDataset } from './types.ts';

export function WardSources({ indicators }: { indicators: WardIndicatorDataset }) {
  const audit = indicators.metadata.source_audit;
  return <details className="ward-sources"><summary>Where the district data comes from</summary>
    <p>Figures were imported from the repository’s <code>london-wards</code> snapshot. The build assigns whole small areas (LSOAs) to wards by official best-fit codes, sums population and published offences, population-weights deprivation, and groups standard Land Registry sales by postcode.</p>
    {audit && <div className="ward-audit"><strong>Partial source verification · {audit.checked_on}</strong><p>{audit.summary}</p><p>Local checks compare ward and neighbourhood totals, CSV and map codes, rates, changes, missing values and sales flags. They establish internal consistency, not a complete reconstruction from publisher downloads.</p><ul>{audit.limitations.map(limit => <li key={limit}>{limit}</li>)}</ul></div>}
    <div className="ward-source-links">{indicators.metadata.sources?.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.publisher} ↗</a><p>{source.note}</p></div>)}</div>
    <p>Crime covers published LSOA categories, with suppressed categories including sexual offences excluded. The publisher also marks residential burglary as unavailable at LSOA level and warns about its February 2024 CONNECT-system change. City of London Police data is absent. IMD includes crime, so the scoring factors overlap.</p>
    <p>ONS, MHCLG, GLA and Land Registry material: Open Government Licence v3.0 with publisher attributions. Met data: Open Government Licence v2.0. Commons neighbourhood names: Open Parliament Licence. Scores and profile weights are FlowCheck assumptions, not publisher statistics.</p>
  </details>;
}
