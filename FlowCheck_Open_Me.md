# FlowCheck district preview

Open [FlowCheck_Open_Me.html](FlowCheck_Open_Me.html) in your browser. If viewing this on GitHub, download the HTML file first, then double-click it. All map data is embedded; no server or installation is needed.

1. Click a London borough to open its districts (electoral wards).
2. Compare the green shades: **darker green means higher attractiveness** on a continuous 0–100 scale. Grey means there is not enough data to score the district.
3. Select a district on the map or in the dropdown to see its population, housing, crime and deprivation figures. The highest-scoring available ward is selected initially.
4. Expand **More district data** for property-type prices, sale counts, age structure and other indicators, or **How attractiveness is graded** for the method.

The display uses the 684 ward records in `datasets/london-wards`, matched to the map by official ward code. Of 704 map wards, 679 have complete, sufficiently reliable indicators for a score. All 25 City of London wards are unscored because crime or small-area indicators are missing; Portsoken also has a low sales count.

The score equally weights favourable London-wide percentiles for lower median sale price, higher population growth, lower recorded crime per resident and lower deprivation. These are explicit screening preferences; the score is not an official rating or a return forecast. Borough budget and appetite matching uses its own borough evidence.

Source periods: population mid-2024 (change from mid-2023), Land Registry sales 2025, Metropolitan Police crime November 2025–October 2026, and English Indices of Deprivation 2025. Ward figures use whole-LSOA best-fit estimates. Central crime rates are affected by visitors and workers; sale medians depend on what sold. Small samples and missing values are labelled in the preview.

See [README.md](README.md) for build instructions and [the dataset notes](datasets/london-wards/README.md) for sources and caveats.
