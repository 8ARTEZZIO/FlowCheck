"""Prepare the official GLA 2025 ward layer for the borough drill-down map."""
from pathlib import Path
from collections import defaultdict
import argparse
import heapq
import json
import math
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SERVICE = 'https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/FeatureServer/18'
PARAMS = {'f': 'geojson', 'where': '1=1', 'outFields': 'ward_code,ward_name,la_gss_code,la_name', 'returnGeometry': 'true', 'outSR': '4326', 'maxAllowableOffset': '0.00005', 'geometryPrecision': '6', 'orderByFields': 'la_gss_code,ward_name'}


def projected(point):
    lon, lat = map(math.radians, point[:2])
    return lon, math.log(math.tan(math.pi / 4 + lat / 2))


def ring_area(ring):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(ring, ring[1:] + ring[:1]))) / 2


def signed_distance(x, y, rings):
    inside = False
    minimum = float('inf')
    for ring in rings:
        for (ax, ay), (bx, by) in zip(ring, ring[1:] + ring[:1]):
            if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
                inside = not inside
            dx, dy = bx - ax, by - ay
            length = dx * dx + dy * dy
            t = min(1, max(0, ((x - ax) * dx + (y - ay) * dy) / length)) if length else 0
            minimum = min(minimum, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2)
    return math.sqrt(minimum) * (1 if inside else -1)


def label_point(rings):
    """Find an interior label position, including for concave wards and holes."""
    xs, ys = zip(*rings[0])
    left, right, top, bottom = min(xs), max(xs), min(ys), max(ys)
    size = min(right - left, bottom - top)
    assert size > 0
    cells = []
    serial = 0

    def cell(x, y, half):
        nonlocal serial
        distance = signed_distance(x, y, rings)
        serial += 1
        return (-distance - half * math.sqrt(2), serial, x, y, half, distance)

    x = left
    while x < right:
        y = top
        while y < bottom:
            heapq.heappush(cells, cell(x + size / 2, y + size / 2, size / 2))
            y += size
        x += size
    best = cell((left + right) / 2, (top + bottom) / 2, 0)
    while cells:
        candidate = heapq.heappop(cells)
        _, _, x, y, half, distance = candidate
        if distance > best[5]:
            best = candidate
        if -candidate[0] - best[5] <= .45:
            continue
        half /= 2
        for dx in (-half, half):
            for dy in (-half, half):
                heapq.heappush(cells, cell(x + dx, y + dy, half))
    assert best[5] > 0, 'No interior label position found'
    return [round(best[2], 2), round(best[3], 2)], round(best[5], 2)


def prepare(data):
    grouped = defaultdict(list)
    seen = set()
    for feature in data['features']:
        properties = feature['properties']
        code = properties['ward_code']
        assert code not in seen, 'Duplicate ward code'
        seen.add(code)
        geometry = feature['geometry']
        assert geometry['type'] in ('Polygon', 'MultiPolygon')
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        polygons = [[[projected(point) for point in ring] for ring in polygon] for polygon in polygons]
        grouped[properties['la_gss_code']].append((properties, polygons))
    evidence = json.loads((ROOT / 'public/data/evidence.json').read_text())
    assert set(grouped) == {area['code'] for area in evidence['boroughs']}, 'Ward-to-borough coverage differs from the evidence'
    boroughs = {}
    for code, features in grouped.items():
        points = [point for _, polygons in features for polygon in polygons for ring in polygon for point in ring]
        xs, ys = zip(*points)
        left, right, bottom, top = min(xs), max(xs), min(ys), max(ys)
        scale = min(800 / (right - left), 550 / (top - bottom))
        offset_x = (900 - (right - left) * scale) / 2
        offset_y = (650 - (top - bottom) * scale) / 2
        wards = []
        for properties, polygons in sorted(features, key=lambda item: item[0]['ward_name']):
            transformed = [[[(offset_x + (x - left) * scale, offset_y + (top - y) * scale) for x, y in ring] for ring in polygon] for polygon in polygons]
            path = ' '.join('M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in ring) + ' Z' for polygon in transformed for ring in polygon)
            largest = max(transformed, key=lambda polygon: ring_area(polygon[0]))
            label, clearance = label_point(largest)
            wards.append({'code': properties['ward_code'], 'name': properties['ward_name'], 'path': path, 'label': label, 'label_clearance': clearance})
        boroughs[code] = {'code': code, 'name': features[0][0]['la_name'], 'viewBox': '0 0 900 650', 'wards': wards}
    return {'metadata': {'publisher': 'Greater London Authority', 'service_url': SERVICE, 'query_url': SERVICE + '/query?' + urllib.parse.urlencode(PARAMS), 'source_vintage': 'London Wards (2025), as labelled by the GLA service', 'retrieved_on': '2026-11-07', 'geography': 'Electoral wards, grouped using the publisher-provided la_gss_code; not informal neighbourhood boundaries', 'projection': 'Mercator, fitted separately to each borough', 'simplification': 'ArcGIS maxAllowableOffset=0.00005 degrees; six-decimal input and two-decimal SVG paths', 'ward_count': len(seen), 'borough_count': len(boroughs), 'attribution': 'Contains Ordnance Survey and National Statistics data, Crown copyright and database right.', 'caveat': 'Display boundaries only. No ward-level housing, price, migration or investment figures are inferred from borough averages.'}, 'boroughs': boroughs}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', type=Path, help='Previously downloaded GLA GeoJSON; otherwise fetch the official layer')
    args = parser.parse_args()
    if args.input:
        raw = json.loads(args.input.read_text())
    else:
        with urllib.request.urlopen(SERVICE + '/query?' + urllib.parse.urlencode(PARAMS), timeout=90) as response:
            raw = json.load(response)
    assert raw.get('type') == 'FeatureCollection' and not raw.get('exceededTransferLimit')
    result = prepare(raw)
    path = ROOT / 'public/data/wards.json'
    path.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    print(f"Prepared {result['metadata']['ward_count']} wards in {len(result['boroughs'])} boroughs: {path.stat().st_size} bytes")
