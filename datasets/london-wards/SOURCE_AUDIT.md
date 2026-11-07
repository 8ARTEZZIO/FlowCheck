# London ward data: source audit

Checked **7 November 2026**. Status: **partially verified**.

Official source identities and periods were checked. All 704 GLA ward identifiers, names and borough parents match; population, growth and population-weighted IMD were independently reproduced for all 20 Camden wards (60 matching values). Crime totals and property prices were not independently rebuilt.

The district display originally imported the **existing repository snapshot**, [london_wards.csv](london_wards.csv). Its documented upstream build is [build_london_wards.py](build_london_wards.py). The original complete raw downloads are not committed, so the entire historical build cannot be certified from this repository alone. Source checks establish which publishers and datasets exist; they do not establish that every derived figure is correct.

## Primary sources and checked scope

| Publisher | Dataset / period | What was established |
| --- | --- | --- |
| [ONS / Nomis](https://www.nomisweb.co.uk/datasets/pestoa2021) | `NM_2014_1` / `PESTOA2021`, mid-2023 and mid-2024 | The [release note](https://www.nomisweb.co.uk/articles/1450.aspx) confirms the 7 November 2025 release. API metadata and 260 Camden observations were retrieved; ward population and growth were reproduced. |
| [MHCLG](https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025) | IoD 2025, File 7 | Official CSV downloaded; Camden population-weighted IMD reproduced. The source was published 30 October 2025 and corrected 17 November 2025. |
| [HM Land Registry](https://www.gov.uk/government/statistical-data-sets/price-paid-data-yearly-file) | Price Paid Data yearly files, 2024 and 2025 | Official download links and documentation confirmed. Prices were not rebuilt from transactions. |
| [Metropolitan Police / London Datastore](https://data.london.gov.uk/dataset/mps-recorded-crime-geographic-breakdown-exy3m) | Published LSOA categories, November 2024–October 2026 | Publisher page confirms the 24-month file. The snapshot uses November 2025–October 2026 and the preceding 12 months. Raw download returned HTTP 403; no independent crime reconstruction. |
| [ONS best-fit lookup](https://geoportal.statistics.gov.uk/datasets/ons::lsoa-2021-to-electoral-ward-2024-to-lad-2024-best-fit-lookup-in-ew/about) | LSOA 2021 → electoral ward 2024 → LAD 2024 | Official ArcGIS item `686527814d73403e8f0a59c7a28b0c34` confirmed; all 130 Camden LSOAs used in the independent reconstruction. |
| [GLA ward layer](https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/FeatureServer/18) | London Wards (2025) | All 704 live ward code/name/borough tuples match the map exactly; polygon vertices were not compared. |
| [ONS ward boundaries](https://www.data.gov.uk/dataset/e8493e3d-619e-4362-aa3a-0a3538177da8/wards-december-2024-boundaries-uk-bgc) | December 2024 UK BGC boundaries | Official listing confirmed, including 20m generalisation and coastal clipping. Derived area/density were not rebuilt. |
| [House of Commons Library](https://houseofcommonslibrary.github.io/msoanames/) | Descriptive 2021 MSOA names | Source and Open Parliament Licence confirmed; page lists version 2.3, 13 February 2026. These are not official ward names. |

## Independent numerical reproduction

For Camden, download the ONS lookup, retrieve Nomis total-resident observations for 2023 and 2024, and join the official IoD File 7 by 2021 LSOA code. Sum population within each assigned ward; calculate growth as `(population_2024 / population_2023 − 1) × 100`; calculate ward IMD as `sum(LSOA_IMD × LSOA_population_2024) / sum(LSOA_population_2024)`. Compare to the bundled precision (growth: two decimals; IMD: three). All 60 checks passed.

| Ward code | Camden ward | Residents, mid-2024 | Growth 2023→2024 (%) | Weighted IMD 2025 | Result |
| --- | --- | ---: | ---: | ---: | --- |
| E05013652 | Belsize | 13,197 | -1.98 | 9.666 | Match |
| E05013653 | Bloomsbury | 14,741 | 4.40 | 21.328 | Match |
| E05013654 | Camden Square | 7,966 | 0.84 | 27.302 | Match |
| E05013655 | Camden Town | 4,981 | -1.52 | 34.701 | Match |
| E05013656 | Fortune Green | 11,572 | -0.80 | 20.977 | Match |
| E05013657 | Frognal | 7,207 | -0.58 | 8.103 | Match |
| E05013658 | Gospel Oak | 12,036 | -1.65 | 25.695 | Match |
| E05013659 | Hampstead Town | 7,189 | -1.15 | 8.505 | Match |
| E05013660 | Haverstock | 11,793 | 0.03 | 31.557 | Match |
| E05013661 | Highgate | 10,501 | 0.23 | 21.187 | Match |
| E05013662 | Holborn & Covent Garden | 10,342 | -1.06 | 27.823 | Match |
| E05013663 | Kentish Town North | 6,404 | -1.61 | 18.677 | Match |
| E05013664 | Kentish Town South | 10,062 | -0.17 | 26.431 | Match |
| E05013665 | Kilburn | 11,221 | -1.23 | 35.821 | Match |
| E05013666 | King's Cross | 11,976 | 1.66 | 29.758 | Match |
| E05013667 | Primrose Hill | 13,989 | -0.47 | 15.083 | Match |
| E05013668 | Regent's Park | 12,621 | 0.40 | 30.706 | Match |
| E05013670 | South Hampstead | 11,813 | -1.62 | 18.326 | Match |
| E05013669 | St Pancras & Somers Town | 14,852 | 1.01 | 35.892 | Match |
| E05013671 | West Hampstead | 12,480 | -0.01 | 20.674 | Match |

## Download fingerprints

These SHA-256 hashes identify the actual official files used for this sample audit. Query URLs, byte counts, source snapshot hash and structured check results are recorded in [source_audit.json](source_audit.json). The original full upstream build has no comparable saved download manifest.

| Audit input | Bytes | SHA-256 |
| --- | ---: | --- |
| population.csv | 84,914 | `ee5040952f61dad463982b11ad57a5fd4aa1bf5bbc66382680386483076d3a16` |
| imd7.csv | 9,897,666 | `b1b716aa2e476449f987b9de3e08255b4794eabfd270626de5de18b2f5eff3ef` |

## Interpretation, coverage and licences

Met LSOA figures cover only the published categories. Its source marks residential burglary and sexual offences as unavailable at LSOA level, and warns that migration to CONNECT after February 2024 affects comparisons. Resident-based rates are influenced by workers and visitors, especially in central wards; they are not personal-risk estimates. City of London Police coverage is absent from the Met-based snapshot.

The Met source specifies **Open Government Licence v2.0**. Population, deprivation and Land Registry sources use OGL v3.0; Commons names use the **Open Parliament Licence**. Land Registry also states attribution and address-data conditions. A blanket claim that every source uses OGL v3.0 is inaccurate.

Ward values are whole-LSOA best-fit estimates. Transaction medians depend on the properties sold; they are not typical-home valuations or investment returns. Small sample warnings, missing data and each indicator’s own reference period remain relevant after this audit.

The green attractiveness score and any Conservative/Balanced/Ambitious weighting are **FlowCheck choices**. No publisher supplies or endorses those attractiveness ratings. Reproducing a source statistic does not validate a particular weighting, establish causation, or calibrate risk. Borough historical HPI variability is separate evidence from ward sale-median changes.

## Limits of this audit

- The display data was imported from the repository's existing london_wards.csv, not freshly assembled from all publishers in this task. The original complete build inputs and their download manifests are absent from the repository.
- Independent numerical reproduction covers population, population change and weighted IMD for 20 Camden wards (60 values), not all 684 ward records or all columns.
- The Met raw CSV download returned HTTP 403. Crime values and coverage could be checked against the repository and the publisher's documentation, but were not independently recomputed from the raw crime file.
- Land Registry price files and official documentation were identified, but property transactions, category filtering, postcode-to-LSOA matches and ward sale medians were not independently rebuilt. The historical claim of a 99.8% postcode match rate cannot be re-established without the original inputs.
- GLA checking covers all 704 ward identifiers, names and borough parents, not the polygon vertices. Area and density fields were not independently recomputed.
- LSOA best-fit allocations produce approximate ward statistics, not exact official ward totals. Missing data and the City of London coverage gap must remain visible.
- Met LSOA figures cover the published categories, not all crime: the source marks residential burglary and sexual offences as unavailable at this level. Crime per resident is distorted by visitors and workers; it is not a personal-risk measure. The publisher also warns about the CONNECT-system change after February 2024.
- Source periods differ. Sales are transactions that were recorded, not available homes or expected returns; medians vary with the mix sold and small sale samples are unreliable.
- Attractiveness scores and Conservative/Balanced/Ambitious weights are FlowCheck screening preferences, not publisher ratings, calibrated risk estimates, causal findings or investment-return forecasts. Official sources validate underlying observations, not a chosen weighted score.

The machine-readable report deliberately uses `status: "partially_verified"`; it must not be presented as complete validation of every ward or an endorsement of investment suitability.

## Additional price file received during this change

The repository also contains `pp-monthly-update-new-version.csv`, added concurrently on `main`. Its 2,644 rows cover transfer dates in 2022–2025, but the file is a **monthly update extract**, not a complete annual history: 1,950 additions (`A`), 448 changes (`C`) and 246 deletions (`D`). Only 391 rows have county `GREATER LONDON`; it has no ward assignments. [Land Registry documentation](https://www.gov.uk/guidance/about-the-price-paid-data) explains the monthly-file status flags and why amendments/deletions must be applied to a complete base dataset.

This file is preserved but is not used to calculate ward medians or historical volatility. Doing so would treat amendments/deletions and a selective national extract as a complete local sales sample. The audit JSON records its hash, counts and exclusion from scoring.
