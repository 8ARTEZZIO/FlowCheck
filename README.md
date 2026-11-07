# FlowCheck

An interactive London housing area screen built for House London: customers enter capital, choose a historical-variability appetite and see matching boroughs on a real map.

## Run the working demo

Double-click the included `FlowCheck_Open_Me.html` to open the standalone demo in Chrome or Edge. The companion `FlowCheck_Open_Me.md` explains the district display. The HTML embeds all evidence, ward geometry and district indicators and needs no Docker, Node.js, Python, database or API key.

The built frontend is included in `dist/`; it works without an API key or database:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open http://localhost:8080.

For frontend development, use Node.js 22.18 or later:

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. `npm run build` produces a fresh `dist/`.

## Full stack: React, Python, PostgreSQL and optional OpenAI

Docker Compose builds the React frontend, starts PostgreSQL, seeds the 33-area evidence snapshot, and serves the Python API through Nginx:

```bash
docker compose up --build
```

Open http://localhost:8080. The web port is bound to the local machine. The database and API are internal Compose services.

The default database password is for a local demonstration. To configure your own settings, copy `.env.example` to `.env` and set a unique `POSTGRES_PASSWORD`. Use a URL-safe password because Compose interpolates it into the PostgreSQL connection URI. Set `OPENAI_API_KEY` only on the server if you want AI-assisted interpretation. `OPENAI_MODEL` defaults to `gpt-5-mini` and can be changed to a model that supports Responses API structured outputs. No key is required for matching or source-based briefs.

To run the API outside Docker with Python 3.12 or later:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
../.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Without `DATABASE_URL`, the API reads the bundled snapshot. With `DATABASE_URL` configured, first run `python -m app.seed` from `backend/`. A configured unavailable or incomplete database returns an explicit service error; it does not silently switch datasets.

For a Vite development frontend connected to the API, set `VITE_API_BASE_URL=http://localhost:8000` in a root `.env` and restart Vite. The Docker frontend uses `/` and Nginx forwards `/api/` to Python. The privately hosted static demo uses local matching and deterministic evidence briefs; it does not run the Python service or PostgreSQL.

## Customer experience

- Capital input, presets, target homes, works allowance and reserve.
- Conservative, Balanced and Ambitious appetite settings with explicit historical variability caps.
- Real London borough map, accessible list alternative, search and exclusion reasons.
- Click a borough on the map, list or shortlist to open its zoomed district view. Inspect official 2025 wards, their attractiveness score and their population, housing, crime and deprivation figures by clicking a shape or using the district selector; use **Back to London** or Escape to return.
- Borough shortlist priorities for population growth, housing delivery or vacancy. Districts use a separate, explained attractiveness score with continuous green shading.
- Saved areas in the customer's browser, CSV export and evidence briefs.
- Official source links, dates, methods, research and data limitations in the interface.

No customer account or personal profile is required. Capital settings remain in browser memory. Saved area codes are stored locally in the browser, not on the server.

## What a match means

An area matches only when both conditions hold:

1. **Capital:** `target homes × (March 2025 borough-average property price + works allowance per home) × (1 + reserve / 100)` is no greater than available capital, rounded to pennies.
2. **Appetite:** historical annualised UK HPI index variability is within the chosen fixed band cap. Conservative covers 0–5%, Balanced covers above 5% to below 15%, and Ambitious covers 15% or higher. These are screening bands, not predictions of returns or loss.

Works and reserve amounts are editable assumptions. This is a cash-only acquisition/reuse reference. It is not a construction-cost estimate, current property quote, lending assessment, tax calculation, property availability count, expected-return model or probability of loss. A fit does not establish a sound property investment. Borough averages conceal property-type and neighbourhood variation.

Appetite is based on price variability, not on migration or the Housing Delivery Test. HDT shortfalls guide investigation; they are not classified as investment losses. Sort priorities change the ordering, not match eligibility.

## District attractiveness preview

Open a borough to see district-level evidence from `datasets/london-wards`. The highest-scoring available ward is initially selected. The map uses a continuous light-to-dark green scale: darker green means a higher score. Hover, click, keyboard selection and the district dropdown all expose the same score; selection changes the outline and preserves the colour.

Attractiveness is an explicit screening preference, calculated independently of the borough capital/appetite filters. Four favourable percentiles each contribute 25%: lower 2025 median sale price, higher mid-2023 to mid-2024 population growth, lower recorded offences per 1,000 residents, and lower IoD 2025 deprivation. Percentiles use a fixed London-wide sample of 679 wards with complete indicators and at least 20 sales. Ties receive their average rank. The score is the mean of those percentiles on a 0–100 scale; colours interpolate continuously across that scale, rather than creating a binary match.

All 704 wards remain selectable. The 25 City of London wards are grey and unscored: five have indicators but lack Metropolitan Police crime coverage, and 20 have geometry only. Portsoken also has fewer than 20 sales and its small-sample warning is shown. Missing indicators are never replaced with zero or borough averages. Each district shows raw values, periods, overlapping neighbourhoods, score components, and expandable property-type, age, density and deprivation data.

This is not an official rating or a return forecast. Whole-LSOA best-fit figures are approximate. Resident-based crime rates in visitor-heavy central wards are not personal-risk measures. Sale medians and changes describe the properties sold, and property-type medians can have very small samples. Borough capital and historical variability calculations continue to use borough evidence.

## Evidence and provenance

All source metadata, exact periods, units, caveats and URLs are embedded in `public/data/`:

| File | Evidence |
| --- | --- |
| `evidence.json` | ONS migration and population, year to mid-2025; HDT 2025 covering 2022/23–2024/25; net dwelling additions 2024/25; Council Tax-recorded long-term vacancies, 6 October 2025; London FDI context, calendar 2024 |
| `market.json` | Archived March 2025 UK HPI prices, published 21 May 2025; official HPI index levels March 2022–March 2025 |
| `boundaries.json` | Actual GLA/Ordnance Survey borough polygons converted into SVG paths |
| `boroughs.geojson` | The corresponding simplified historical borough GeoJSON |
| `wards.json` | GLA London Wards (2025): 704 official electoral wards, grouped into all 33 boroughs using the publisher's parent codes; separately fitted maps for each borough |
| `ward-indicators.json` | All 684 `datasets/london-wards/london_wards.csv` records joined by ward and borough code, with source periods, nulls and reliability flags; 20 City wards have geometry only |
| `policy.json` | Shared profile defaults, capital method, risk method and appetite rules |

Source register: `Data Asset Register.xlsx`, House London. Annual migration and FDI flows were supplements to gaps in that register; their source relationship is recorded in `evidence.json`.

Historical variability is sample standard deviation (n−1 denominator) of 36 monthly log index changes, April 2022–March 2025, multiplied by square root of 12 and 100. All 33 areas have 37 monthly index levels. Historical drawdown is the largest fall from a prior peak across the same levels. The published index levels are rounded to one decimal place. These calculations describe an area-level historical index, not a calibrated investment-risk model.

People, households and dwellings are different units. Different reference periods are labelled and are not treated as a common causal panel. Recorded vacancies do not identify available or recoverable homes, or overseas ownership. London FDI is business-investment context, not a borough housing funding allocation. Geometry is simplified and unsuitable for site/legal boundaries.

Contains HM Land Registry, ONS, MHCLG, GLA and Ordnance Survey public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). The dataset files include original publisher attributions. Data retrieval: 7 November 2026. The app intentionally uses a fixed historical snapshot; it does not claim to provide live prices.

## Optional AI interpretation

Python calls the OpenAI Responses API with a strict JSON schema only when a server API key is configured. The model receives selected public area indicators; customer capital and allowance values are not sent in the model prompt. Numerical facts, budgets, eligibility, source links and next-step actions remain deterministic. Only a short qualitative interpretation can be appended. Unknown source identifiers, unexpected numeric output, malformed responses and provider errors fall back to the original evidence template. Source-identifier validation is not a guarantee that generated prose is factually correct; the UI identifies AI-assisted output.

Brief requests have an in-process rate limit. For multiple API instances, replace it with an ingress/shared limiter. The application does not persist brief requests or customer capital profiles. No OpenAI key is included in frontend code. Production infrastructure, authentication if needed, and site-specific financial diligence remain deployment choices.

## API

| Route | Use |
| --- | --- |
| `GET /api/health` | Evidence-store health and area coverage |
| `GET /api/areas` | Published aggregate area data, policy and sources |
| `POST /api/match` | Validated profile to matching/excluded boroughs and explanations |
| `POST /api/brief` | Area code and profile to a source-based brief; optional AI interpretation |
| `GET /docs` | Interactive API documentation when running FastAPI directly |

Example profile:

```json
{"capital":500000,"appetite":"conservative","works_allowance":50000,"reserve_percent":10,"homes":1,"focus":"growth"}
```

This profile matches Barking and Dagenham in the bundled snapshot. Havering's one-home capital reference is £549,728.30, so it is excluded by that £500,000 budget despite meeting the conservative variability cap.

## Verification

```bash
npm test
npm run build
cd backend
python3 -m unittest discover -s tests -v
```

There are 22 client/model tests, including nine district import/scoring tests, and 12 Python/API tests, including matching at the penny boundary, capital/appetite monotonicity, source control totals, missing-data failure, validation, rate limiting, no-key fallback and cross-language parity. Node's parity test needs Python with the backend requirements installed; set `FLOWCHECK_PYTHON` if using a virtual environment.

Browser checks cover risk changes, low/invalid capital, saved areas, search, list/map views, evidence briefs and CSV export. A production build is included. Docker was unavailable in the build environment, so the containerised PostgreSQL stack was not executed there. A live OpenAI request was not tested because no API key was supplied; the no-key workflow was tested.

## Research informing investigation prompts

- Hilber & Vermeulen (2016), *The Impact of Supply Constraints on House Prices in England*, The Economic Journal. https://doi.org/10.1111/ecoj.12213
- Greenaway-McGrevy & Phillips (2023), *The Impact of Upzoning on Housing Construction in Auckland*, Journal of Urban Economics. https://doi.org/10.1016/j.jue.2023.103555
- Carozzi, Hilber & Yu (2024), *On the Economic Impacts of Mortgage Credit Expansion Policies: Evidence from Help to Buy*, Journal of Urban Economics. https://doi.org/10.1016/j.jue.2023.103611
- Segú (2020), *The Impact of Taxing Vacancy on Housing Markets: Evidence from France*, Journal of Public Economics. https://doi.org/10.1016/j.jpubeco.2019.104079
- Freemark (2020), *Upzoning Chicago*, Urban Affairs Review. https://doi.org/10.1177/1078087418824672

These studies inform questions and possible interventions. They do not validate FlowCheck's risk bands or imply that an intervention's estimated effect transfers to a London borough.

## Refresh district geometry and rebuild the standalone demo

The prepared ward snapshot is bundled. To fetch the official GLA ward layer again, run `python3 scripts/import-wards.py`. Ward geometry remains labelled with the GLA 2025 source vintage. Reimport the bundled CSV and rebuild both standalone copies with:

```bash
python3 scripts/import-ward-indicators.py
npm run build
python3 scripts/export-offline.py FlowCheck_Open_Me.html
python3 scripts/export-offline.py
```

The local importer validates the CSV-to-map join without downloads. The exports embed all district figures in the repository-root and `dist/` HTML files, so the preview needs no server or external data requests.
