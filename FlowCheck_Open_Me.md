# FlowCheck district preview

Open [FlowCheck_Open_Me.html](FlowCheck_Open_Me.html) in your browser. If viewing this on GitHub, download the HTML file first, then double-click it. All map data is embedded; no server or installation is needed.

1. Click a London borough to open its districts (electoral wards).
2. Choose **Conservative**, **Balanced** or **Ambitious**; district scores and colours update immediately. Compare the green shades: **darker green means higher attractiveness** on a continuous 0–100 scale. Grey means there is not enough data to score the district.
3. Select a district on the map or in the dropdown to see its population, housing, crime and deprivation figures. The highest-scoring available ward is selected initially.
4. Expand **More district data** for property-type prices, sale counts, age structure and other indicators, or **How attractiveness is graded** for the method.

The display uses the 684 ward records in `datasets/london-wards`, matched to the map by official ward code. Of 704 map wards, 679 have complete, sufficiently reliable indicators for a score. All 25 City of London wards are unscored because crime or small-area indicators are missing; Portsoken also has a low sales count.

The score uses favourable London-wide percentiles with these explicit profile weights:

| Profile | Affordability | Population growth | Lower published crime | Lower deprivation |
| --- | ---: | ---: | ---: | ---: |
| Conservative | 25% | 5% | 35% | 35% |
| Balanced | 25% | 25% | 25% | 25% |
| Ambitious | 35% | 45% | 10% | 10% |

Conservative emphasises lower crime and deprivation; Ambitious emphasises growth and affordability. All profiles use the same reference wards and favourable directions. IMD includes crime, so factors overlap. These are explicit screening preferences; the score is not an official rating or a return forecast. Borough budget and appetite matching uses its own borough evidence.

Source periods: population mid-2024 (change from mid-2023), Land Registry sales 2025, Metropolitan Police crime November 2025–October 2026, and English Indices of Deprivation 2025. Ward figures use whole-LSOA best-fit estimates. Central crime rates are affected by visitors and workers; sale medians depend on what sold. Small samples and missing values are labelled in the preview.

Expand **Where the district data comes from** for original publisher links and verification limits. [The source audit](datasets/london-wards/SOURCE_AUDIT.md) confirms the official datasets and independently reproduces population, growth and deprivation for Camden's 20 wards (60 matching values), plus all 704 live GLA ward identifiers. This is partial verification: prices and crime totals have not been independently rebuilt. The Met raw CSV returned HTTP 403, and the original full build inputs are not retained. Published LSOA crime excludes suppressed categories, including sexual offences and source-marked residential burglary. City crime-category labels are suppressed where totals are missing.

See [README.md](README.md) for build instructions and [the dataset notes](datasets/london-wards/README.md) for sources and caveats.
