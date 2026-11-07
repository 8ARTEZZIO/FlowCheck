"""Join the bundled London ward indicators to map wards by their ONS codes.

This is a local, deterministic import: no downloads and no name-based joins.
Run from any directory with `python3 scripts/import-ward-indicators.py`.
"""
from pathlib import Path
import csv
import json
import math


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'datasets/london-wards/london_wards.csv'
OUTPUT = ROOT / 'public/data/ward-indicators.json'
TEXT_COLUMNS = {
    'borough', 'borough_code', 'ward_name', 'ward_code', 'neighbourhoods',
    'top_crime_group',
}
INTEGER_COLUMNS = {
    'lsoa_count', 'pop_2024', 'crime_last12', 'crime_prev12', 'sales_2025',
    'sales_flat_2025', 'sales_terraced_2025', 'sales_semi_2025',
    'sales_detached_2025', 'sales_2024',
}


def typed_value(column, value):
    if value == '':
        return None
    if column in TEXT_COLUMNS:
        return value
    if column == 'low_sales_flag':
        assert value in ('True', 'False'), f'Invalid low-sales flag: {value}'
        return value == 'True'
    number = float(value)
    assert math.isfinite(number), f'Non-finite {column}: {value}'
    if column in INTEGER_COLUMNS:
        assert number.is_integer(), f'Non-integral count in {column}: {value}'
        return int(number)
    return number


def prepare():
    geometry = json.loads((ROOT / 'public/data/wards.json').read_text())
    parents = {}
    for borough_code, group in geometry['boroughs'].items():
        assert borough_code == group['code'], 'Borough geometry code mismatch'
        for ward in group['wards']:
            assert ward['code'] not in parents, 'Duplicate map ward code'
            parents[ward['code']] = borough_code

    wards = {}
    with SOURCE.open(encoding='utf-8', newline='') as source:
        reader = csv.DictReader(source)
        assert TEXT_COLUMNS | INTEGER_COLUMNS | {'low_sales_flag'} <= set(reader.fieldnames or []), 'Missing source columns'
        for raw in reader:
            row = {column: typed_value(column, value) for column, value in raw.items()}
            code = row['ward_code']
            assert code and code not in wards, f'Duplicate or empty indicator ward code: {code}'
            assert code in parents, f'Indicator ward has no map geometry: {code}'
            assert parents[code] == row['borough_code'], f'Indicator/map borough mismatch: {code}'
            wards[code] = row

    missing = sorted(set(parents) - set(wards))
    assert len(wards) == 684, 'Expected all 684 rows from the bundled indicator snapshot'
    assert len(parents) == 704, 'Expected all 704 official map wards'
    assert len(missing) == 20 and all(parents[code] == 'E09000001' for code in missing), 'Unexpected wards without indicator data'
    metadata = {
        'source_file': 'datasets/london-wards/london_wards.csv',
        'built_on': '2026-11-07',
        'ward_count': len(wards),
        'geometry_ward_count': len(parents),
        'missing_indicator_ward_count': len(missing),
        'missing_indicator_ward_codes': missing,
        'minimum_reliable_sales': 20,
        'join_method': 'Exact ward_code and borough_code match to map geometry; no name matching or borough-value substitution.',
        'periods': {
            'geography': 'December 2024 wards and local authority districts; matched by code to the GLA 2025 map layer',
            'population': 'Mid-2024; population change from mid-2023 to mid-2024',
            'deprivation': 'English Indices of Deprivation 2025',
            'crime': 'November 2025–October 2026; comparison November 2024–October 2025',
            'sales': 'Calendar 2025; comparison calendar 2024',
            'neighbourhood_names': '2021 MSOAs',
        },
        'sources': [
            {'publisher': 'Office for National Statistics', 'url': 'https://geoportal.statistics.gov.uk', 'note': 'December 2024 ward boundaries and LSOA 2021 to ward 2024 best-fit lookup.'},
            {'publisher': 'Office for National Statistics / Nomis', 'url': 'https://www.nomisweb.co.uk', 'note': 'Small-area population estimates, mid-2023 and mid-2024 (NM_2014_1).'},
            {'publisher': 'HM Land Registry', 'url': 'https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads', 'note': 'Price Paid Data, category A standard market sales, calendar 2024 and 2025.'},
            {'publisher': 'Ministry of Housing, Communities and Local Government', 'url': 'https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025', 'note': 'English Indices of Deprivation 2025, File 7; population-weighted ward scores.'},
            {'publisher': 'Metropolitan Police Service', 'url': 'https://data.london.gov.uk/dataset/mps-recorded-crime-geographic-breakdown-exy3m', 'note': 'LSOA recorded offences over the latest 24 months in the bundled snapshot.'},
            {'publisher': 'House of Commons Library', 'url': 'https://houseofcommonslibrary.github.io/msoanames', 'note': 'Common neighbourhood names for 2021 MSOAs; Open Parliament Licence.'},
            {'publisher': 'postcodes.io', 'url': 'https://postcodes.io', 'note': 'Postcode to LSOA lookup built on the ONS Postcode Directory.'},
        ],
        'caveats': [
            'Whole LSOAs are assigned by best fit, so values near ward boundaries are approximate rather than exact official ward totals.',
            'The 20 City of London wards without assigned LSOAs have geometry only. The five City wards with indicators have no Metropolitan Police crime figures; missing values remain null.',
            'Recorded offences per 1,000 residents are affected by visitors and workers, particularly in central London; this is not a personal-risk measure.',
            'Medians describe properties sold rather than a typical home. Fewer than 20 sales is flagged as unreliable; property-type medians can have still smaller samples.',
            'Changes in sale medians reflect the mix of properties sold and do not measure investment returns. IoD 2025 is not comparable with IoD 2019.',
            'Neighbourhood names overlap wards and are not separate mapped boundaries. Source periods differ and are labelled separately.',
        ],
        'attribution': 'Contains HM Land Registry, Ordnance Survey and National Statistics data © Crown copyright and database right 2026. Public sector information under the Open Government Licence v3.0, except House of Commons Library names under the Open Parliament Licence.',
    }
    return {'metadata': metadata, 'wards': dict(sorted(wards.items()))}


if __name__ == '__main__':
    data = prepare()
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f"Prepared {len(data['wards'])} ward indicator rows; {data['metadata']['missing_indicator_ward_count']} map wards have no indicators: {OUTPUT.stat().st_size} bytes")
