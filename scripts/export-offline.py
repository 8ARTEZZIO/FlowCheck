"""Export the built React app and evidence as a double-clickable HTML demo."""
from pathlib import Path
import argparse
import base64
import json
import re

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('output', nargs='?', type=Path, default=ROOT / 'dist/FlowCheck_Open_Me.html')
args = parser.parse_args()
dist = ROOT / 'dist'
html = (dist / 'index.html').read_text()
js_match = re.search(r'<script\b[^>]*src="(/assets/[^\"]+\.js)"[^>]*></script>', html)
css_match = re.search(r'<link\b[^>]*href="(/assets/[^\"]+\.css)"[^>]*>', html)
assert js_match and css_match, 'Build the app before exporting the offline demo'
script = (dist / js_match.group(1).lstrip('/')).read_text()
style = (dist / css_match.group(1).lstrip('/')).read_text()
style = re.sub(r'''@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')[^;]*;''', '', style)
assert '@import' not in style and 'url(' not in style, 'External styles would break the offline demo'
bundle = {name: json.loads((ROOT / 'public/data' / f'{name}.json').read_text()) for name in ('evidence', 'market', 'boundaries', 'policy', 'wards', 'ward-indicators')}
payload = json.dumps(bundle, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
assert '</script' not in script.lower() and '</style' not in style.lower()
html = html.replace(js_match.group(0), '').replace(css_match.group(0), '<style>\n' + style + '\n</style>')
favicon = base64.b64encode((ROOT / 'public/favicon.svg').read_bytes()).decode()
html = html.replace('href="/favicon.svg"', 'href="data:image/svg+xml;base64,' + favicon + '"')
html = html.replace('<title>FlowCheck — Find your fit in London</title>', '<title>FlowCheck — Offline Demo</title>')
inline = '<script id="flowcheck-offline-data" type="application/json">' + payload + '</script>\n'
inline += '<script type="module">\nglobalThis.__FLOWCHECK_DATA__ = JSON.parse(document.getElementById("flowcheck-offline-data").textContent);\n' + script + '\n</script>\n'
html = html.replace('</body>', inline + '</body>')
assert 'src="/assets/' not in html and 'href="/assets/' not in html
assert len(bundle['wards']['boroughs']) == 33
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html)
print(f'Exported {args.output}: {args.output.stat().st_size} bytes, 33 boroughs and {bundle["wards"]["metadata"]["ward_count"]} wards')
