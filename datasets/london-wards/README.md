# London ward & neighbourhood dataset

Ready-to-use area data for London, more detailed than borough level: **684 wards** (e.g. Camden Town, Kentish Town North, Hampstead Town) and **1,002 neighbourhoods** (House of Commons Library MSOA names such as "Camden Town & Mornington Crescent"). Built 7 November 2026 from official open data.

## Files

| File | What it is |
|---|---|
| `london_wards.csv` | One row per ward (Dec 2024 boundaries), all indicators below. Opens in Excel / Google Sheets. |
| `london_wards.geojson` | Ward boundaries for maps (WGS84) with the same columns attached. Drop into geojson.io, QGIS, Mapbox, Leaflet. |
| `london_neighbourhoods.csv` | Same indicators per neighbourhood (MSOA 2021), with its common local name. Area and density are not included at this level. |
| `build_london_wards.py` | Script that rebuilds everything from the source downloads. |
| `pp-monthly-update-new-version.csv` | Additional 2,644-row national monthly-update extract filtered to transfer dates in 2022–2025. Includes additions/changes/deletions, not a complete annual or ward series; preserved but excluded from scoring. See source audit. |
| `build_summary.json` | Row counts and periods from the last build. |
| `SOURCE_AUDIT.md`, `source_audit.json` | Primary-source checks, independent Camden comparisons, source hashes and explicit verification limits. Status: partially verified. |
| `validation_report.json` | Reproducible local consistency checks; generate with `python3 ../../scripts/validate-ward-data.py`. |

## Columns

| Column | Meaning | Period |
|---|---|---|
| `borough`, `borough_code`, `ward_name`, `ward_code` | Names and ONS codes (LAD 2024 / WD 2024) | Dec 2024 |
| `neighbourhoods` | MSOA neighbourhood names overlapping the ward, largest first | 2021 MSOAs |
| `lsoa_count` | Number of small areas (LSOA 2021) assigned to the ward | |
| `area_km2`, `pop_density_per_km2` | Approximate land area from generalised boundaries, and residents per km² | |
| `pop_2024`, `pop_change_2023_24_pct` | Usual residents and one-year change | mid-2023 → mid-2024 |
| `pct_age_0_15`, `pct_age_16_64`, `pct_age_65_plus` | Age structure, % of residents | mid-2024 |
| `imd_score` | Index of Multiple Deprivation score, population-weighted (higher = more deprived) | IoD 2025 |
| `income_score`, `crime_dep_score`, `housing_barriers_score`, `living_env_score` | IMD domain scores, population-weighted | IoD 2025 |
| `pct_lsoas_most_deprived_20pct` | % of the ward's small areas in England's most deprived 20% | IoD 2025 |
| `crime_last12`, `crime_prev12` | Offences in published Met LSOA categories, last 12 months and the 12 before; excludes suppressed categories | Nov 2025–Oct 2026 / Nov 2024–Oct 2025 |
| `crime_per_1000`, `crime_change_pct`, `top_crime_group` | Offences per 1,000 residents, year-on-year change, most common category | Nov 2025–Oct 2026 |
| `sales_2025`, `median_price_2025`, `mean_price_2025` | Standard market sales recorded by Land Registry | calendar 2025 |
| `median_{flat,terraced,semi,detached}_2025`, `sales_{type}_2025` | Median and count by property type | calendar 2025 |
| `new_build_share_2025_pct` | % of 2025 sales that were new builds | calendar 2025 |
| `sales_2024`, `median_price_2024`, `median_change_2024_25_pct` | Prior-year comparison | calendar 2024 |
| `low_sales_flag` | `True` when fewer than 20 sales in 2025: treat the median as unreliable | |

## How it was built

- **Small areas → wards:** each LSOA 2021 is assigned to one ward using the ONS *best-fit* lookup, then summed (population, crime, sales) or population-weighted (deprivation scores).
- **Sales:** Land Registry Price Paid, category A only (standard sales at market value; excludes repossessions, buy-to-let portfolio and non-market transfers). Each sale's postcode is mapped to its LSOA via postcodes.io (the original build documents 99.8% matched; this rate cannot be independently reproduced without its raw inputs).
- **Neighbourhood names:** from the House of Commons Library; these are recognisable local names, not official ward names.

## Caveats

- **Best-fit, not exact.** Ward totals are built from whole LSOAs, so population and sales near ward edges can be assigned to a neighbouring ward. Fine for comparison and screening, not for precise official ward counts.
- **City of London:** its 25 tiny wards collapse to 5 under best-fit, and crime is blank because the City is policed by City of London Police, which is not in the Met dataset. The GeoJSON still contains all 704 polygons; the 20 City wards without LSOAs have names only.
- **Crime per 1,000 residents** is very high in central wards (Bloomsbury, Camden Town, Holborn, West End) because many visitors and workers but few residents are there. It is a resident-based rate, not personal risk.
- **Published crime coverage:** the Met source excludes sexual offences at LSOA level and also marks residential burglary as unavailable. Counts are published-category totals, not all crime. CONNECT-system changes after February 2024 affect comparison. City category names from partial Met records are not complete City evidence and are suppressed in the preview.
- **Verification:** authoritative source identities/periods are confirmed; all 60 Camden population/growth/weighted-IMD values and all 704 live GLA ward identifiers match. Sales and crime totals have not been independently reconstructed. See [SOURCE_AUDIT.md](SOURCE_AUDIT.md).
- **Small samples:** property-type medians can rest on a handful of sales. Check the matching `sales_*` count before relying on a median.
- **IoD 2025** is not comparable with IoD 2019.
- Medians describe what sold, not the value of the typical home, and change with the mix of properties sold.

## Sources (all Open Government Licence v3.0 unless noted)

- ONS Wards (December 2024) Boundaries UK BGC and LSOA (2021) → Ward (2024) → LAD (2024) Best Fit Lookup: https://geoportal.statistics.gov.uk/datasets/ons::lsoa-2021-to-electoral-ward-2024-to-lad-2024-best-fit-lookup-in-ew/about
- HM Land Registry Price Paid Data, 2024 and 2025: https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads. Contains HM Land Registry data © Crown copyright and database right 2026.
- ONS small-area population estimates, mid-2023 and mid-2024 (Nomis NM_2014_1): https://www.nomisweb.co.uk/datasets/pestoa2021
- MHCLG English Indices of Deprivation 2025, File 7: https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025
- Metropolitan Police Service, Recorded Crime: Geographic Breakdown, published LSOA categories, November 2024–October 2026 (Open Government Licence v2.0): https://data.london.gov.uk/dataset/mps-recorded-crime-geographic-breakdown-exy3m
- House of Commons Library MSOA Names (Open Parliament Licence): https://houseofcommonslibrary.github.io/msoanames
- Postcode lookup via postcodes.io (built on ONS Postcode Directory).

Contains OS data © Crown copyright and database right 2026. Contains National Statistics data © Crown copyright and database right 2026.

## Rebuild

The builder now rejects incomplete population/deprivation joins, missing non-City crime coverage and nonconsecutive crime months; it reports unmatched sales and suppresses incomplete City crime categories. The original raw inputs are not bundled.

Download the inputs listed at the top of `build_london_wards.py`, then:

```bash
python3 build_london_wards.py <download_dir> .
```
