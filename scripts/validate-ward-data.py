"""Validate the bundled ward snapshot without claiming an upstream reconstruction.

Usage: python3 scripts/validate-ward-data.py [--output PATH]
All checks use local files and the Python standard library. The report is stable
for the same inputs and includes SHA-256 hashes of every checked source file.
"""
from pathlib import Path
import argparse
import csv
import hashlib
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'datasets/london-wards'
DEFAULT_OUTPUT = DATA / 'validation_report.json'
TEXT = {'borough', 'borough_code', 'ward_name', 'ward_code', 'neighbourhoods',
        'neighbourhood', 'msoa_code', 'msoa_name', 'top_crime_group'}
COUNTS = {'lsoa_count', 'pop_2024', 'crime_last12', 'crime_prev12', 'sales_2025',
          'sales_2024', 'sales_flat_2025', 'sales_terraced_2025',
          'sales_semi_2025', 'sales_detached_2025'}
ADDITIVE = ('pop_2024', 'lsoa_count', 'crime_last12', 'crime_prev12', 'sales_2025', 'sales_2024')
CRIME = ('crime_last12', 'crime_prev12', 'crime_per_1000', 'crime_change_pct')
PROPERTY_TYPES = ('flat', 'terraced', 'semi', 'detached')
RAW_INPUTS = ('lsoa_ward_lookup.json', 'wards_raw.geojson', 'london_pp.csv',
              'pc_lsoa.csv', 'imd7.csv', 'crime_lsoa.csv', 'pop_2023.csv',
              'pop_2024.csv', 'pop_age_2024.csv', 'msoanames.csv')


def read_csv(path):
    rows = []
    with path.open(encoding='utf-8', newline='') as source:
        for raw in csv.DictReader(source):
            row = {}
            for column, value in raw.items():
                if value == '':
                    row[column] = None
                elif column in TEXT:
                    row[column] = value
                elif column == 'low_sales_flag':
                    if value not in ('True', 'False'):
                        raise ValueError(f'Invalid low-sales flag in {path.name}')
                    row[column] = value == 'True'
                else:
                    number = float(value)
                    if not math.isfinite(number):
                        raise ValueError(f'Nonfinite {column} in {path.name}')
                    if column in COUNTS and (not number.is_integer() or number < 0):
                        raise ValueError(f'Invalid count {column} in {path.name}')
                    row[column] = int(number) if column in COUNTS else number
            rows.append(row)
    return rows


def validate():
    checked_files = [DATA / name for name in ('london_wards.csv', 'london_neighbourhoods.csv',
                    'london_wards.geojson', 'build_summary.json', 'build_london_wards.py')]
    checked_files += [ROOT / 'public/data/wards.json']
    report = {
        'status': 'snapshot_consistency_passed',
        'scope': 'Local snapshot consistency, joins, arithmetic, missing values and cross-geography control totals.',
        'upstream_reproduction': {
            'status': 'not_performed_raw_inputs_not_bundled',
            'limitation': 'Original publisher downloads and their retrieval manifests/hashes are not bundled. Internal consistency does not independently verify the upstream numerical values or prove that every download was complete.',
            'expected_raw_inputs': list(RAW_INPUTS),
        },
        'source_files': {str(path.relative_to(ROOT)): {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                         'bytes': path.stat().st_size} for path in checked_files},
        'checks': [],
        'warnings': [],
    }

    def check(identifier, condition, detail):
        report['checks'].append({'id': identifier, 'status': 'passed' if condition else 'failed', 'detail': detail})
        if not condition:
            report['status'] = 'snapshot_consistency_failed'

    wards, neighbourhoods = read_csv(DATA / 'london_wards.csv'), read_csv(DATA / 'london_neighbourhoods.csv')
    features = json.loads((DATA / 'london_wards.geojson').read_text())['features']
    geometry = json.loads((ROOT / 'public/data/wards.json').read_text())['boroughs']
    summary = json.loads((DATA / 'build_summary.json').read_text())
    ward_by_code = {row['ward_code']: row for row in wards}
    feature_by_code = {feature['properties']['ward_code']: feature['properties'] for feature in features}
    map_parents = {ward['code']: code for code, group in geometry.items() for ward in group['wards']}
    check('row_counts_and_unique_codes', len(wards) == len(ward_by_code) == summary['wards'] == 684
          and len(neighbourhoods) == len({row['msoa_code'] for row in neighbourhoods}) == summary['neighbourhoods'] == 1002
          and len(features) == len(feature_by_code) == len(map_parents) == 704,
          {'wards': len(wards), 'neighbourhoods': len(neighbourhoods), 'geojson_features': len(features), 'map_wards': len(map_parents)})
    check('official_code_and_borough_join', set(feature_by_code) == set(map_parents)
          and all(code in map_parents and map_parents[code] == row['borough_code'] for code, row in ward_by_code.items()),
          'Every indicator ward matches the map by ward code and parent borough; GeoJSON and map have the same full ward-code set.')
    mismatches = [(code, column) for code, row in ward_by_code.items() for column, value in row.items()
                  if feature_by_code.get(code, {}).get(column) != value]
    check('csv_geojson_cell_parity', not mismatches, {'mismatched_cells': len(mismatches)})
    missing = sorted(set(map_parents) - set(ward_by_code))
    check('geometry_only_wards', len(missing) == 20 and all(map_parents[code] == 'E09000001' for code in missing),
          {'count': len(missing), 'ward_codes': missing, 'expected_reason': 'City of London wards without best-fit LSOAs.'})
    null_crime = [row['ward_code'] for row in wards if any(row[column] is None for column in CRIME)]
    check('crime_missing_values_are_explicit', len(null_crime) == 5
          and all(all(row[column] is None for column in CRIME) if row['borough_code'] == 'E09000001'
                  else all(row[column] is not None for column in CRIME) for row in wards),
          {'ward_codes': null_crime, 'reason': 'Metropolitan Police coverage excludes City of London Police.'})
    city_partial_categories = [row['ward_code'] for row in wards if row['crime_last12'] is None and row['top_crime_group'] is not None]
    if city_partial_categories:
        report['warnings'].append({'id': 'partial_city_crime_categories', 'ward_codes': city_partial_categories,
            'detail': 'Some City wards have a crime category from partial Met records despite null totals. Treat those categories as unavailable; they do not establish City of London Police coverage.'})

    totals = {}
    boroughs = sorted({row['borough_code'] for row in wards})
    check('borough_coverage', len(boroughs) == 33 and set(boroughs) == {row['borough_code'] for row in neighbourhoods} == set(geometry),
          {'borough_count': len(boroughs)})
    for column in ADDITIVE:
        ward_total = sum(row[column] or 0 for row in wards)
        neighbourhood_total = sum(row[column] or 0 for row in neighbourhoods)
        failures = [code for code in boroughs
                    if sum(row[column] or 0 for row in wards if row['borough_code'] == code)
                    != sum(row[column] or 0 for row in neighbourhoods if row['borough_code'] == code)]
        totals[column] = ward_total
        check('control_total_' + column, ward_total == neighbourhood_total and not failures,
              {'ward_total': ward_total, 'neighbourhood_total': neighbourhood_total, 'borough_mismatches': failures})
    check('build_summary_control_totals', totals['lsoa_count'] == summary['lsoas']
          and totals['sales_2025'] == summary['sales_matched_2025'] and totals['sales_2024'] == summary['sales_matched_2024'],
          'LSOA and annual sale totals agree with the original build summary.')
    report['totals'] = totals

    failures = {name: [] for name in ('required_fields', 'bounds', 'age_shares', 'crime_rate', 'crime_change',
                'sale_median_change', 'low_sales_flag', 'property_samples', 'density')}
    for name, rows, code_column in [('wards', wards, 'ward_code'), ('neighbourhoods', neighbourhoods, 'msoa_code')]:
        for row in rows:
            key = name + ':' + row[code_column]
            needed = ('pop_2024', 'pop_change_2023_24_pct', 'imd_score', 'income_score', 'crime_dep_score',
                      'housing_barriers_score', 'living_env_score', 'sales_2025', 'sales_2024', 'median_price_2025', 'median_price_2024')
            if any(row[column] is None for column in needed):
                failures['required_fields'].append(key)
                continue
            if row['pop_2024'] <= 0 or row['lsoa_count'] <= 0 or any(row[column] <= 0 for column in ('median_price_2025', 'median_price_2024', 'mean_price_2025')):
                failures['bounds'].append(key)
            shares = [row[column] for column in ('pct_age_0_15', 'pct_age_16_64', 'pct_age_65_plus')]
            if any(value is None or not 0 <= value <= 100 for value in shares) or abs(sum(shares) - 100) > .151:
                failures['age_shares'].append(key)
            for column in ('new_build_share_2025_pct', 'pct_lsoas_most_deprived_20pct'):
                if row[column] is not None and not 0 <= row[column] <= 100:
                    failures['bounds'].append(key + ':' + column)
            if row['crime_last12'] is not None:
                if abs(row['crime_per_1000'] - row['crime_last12'] / row['pop_2024'] * 1000) > .051:
                    failures['crime_rate'].append(key)
                if row['crime_prev12'] and abs(row['crime_change_pct'] - (row['crime_last12'] / row['crime_prev12'] - 1) * 100) > .051:
                    failures['crime_change'].append(key)
            if abs(row['median_change_2024_25_pct'] - (row['median_price_2025'] / row['median_price_2024'] - 1) * 100) > .051:
                failures['sale_median_change'].append(key)
            if row['low_sales_flag'] != (row['sales_2025'] < summary['min_sales_flag']):
                failures['low_sales_flag'].append(key)
            property_counts = [row[f'sales_{kind}_2025'] or 0 for kind in PROPERTY_TYPES]
            if sum(property_counts) > row['sales_2025'] or any((row[f'median_{kind}_2025'] is not None) != bool(row[f'sales_{kind}_2025']) for kind in PROPERTY_TYPES):
                failures['property_samples'].append(key)
            if name == 'wards' and (row['area_km2'] is None or row['area_km2'] <= 0 or abs(row['pop_density_per_km2'] - row['pop_2024'] / row['area_km2']) > .51):
                failures['density'].append(key)
    for identifier, failed_rows in failures.items():
        check(identifier, not failed_rows, {'rows_checked': len(wards) + len(neighbourhoods) if identifier != 'density' else len(wards), 'failed_rows': failed_rows})
    report['warnings'].append({'id': 'non_causal_screening_evidence', 'detail': 'Different reference periods, best-fit LSOA geography, resident-based central crime rates and changing sale mixes limit interpretation. Two annual sale medians do not establish ward volatility or forecast investment returns.'})
    report['passed_checks'] = sum(check['status'] == 'passed' for check in report['checks'])
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    result = validate()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + '\n', encoding='utf-8')
    print(f"{result['status']}: {result['passed_checks']}/{len(result['checks'])} checks passed; report {args.output}")
    sys.exit(0 if result['status'] == 'snapshot_consistency_passed' else 1)
