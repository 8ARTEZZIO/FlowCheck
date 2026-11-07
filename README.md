# FlowCheck

Explore London boroughs that fit your capital and historical price-variability appetite. Click any borough to zoom into its official 2025 ward map, then choose a district or return to London.

## Run the demo

Download this repository as a ZIP, extract it, and double-click **FlowCheck/FlowCheck_Open_Me.html** in Chrome or Edge. The standalone demo embeds the data and needs no installation or API key.

## Develop or run the full stack

See [the project README](FlowCheck/README.md) for React, Python, PostgreSQL, Docker and optional OpenAI setup, data sources and calculation methods.

The current version includes all 33 London boroughs and 704 official wards. Capital and risk screening uses borough-level evidence; it does not infer district-level property prices or investment returns.

Validation: 13 automated checks passed, including geography coverage and Python/client matching consistency; district selection and return navigation were also checked in the browser.
