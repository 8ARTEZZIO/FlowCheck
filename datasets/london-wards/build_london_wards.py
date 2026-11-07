"""Build ward- and neighbourhood (MSOA)-level London datasets for FlowCheck.

Inputs (downloaded into DL directory, see README.md for URLs):
  lsoa_ward_lookup.json  ONS LSOA21 -> Ward 2024 -> LAD 2024 best-fit lookup (London only)
  wards_raw.geojson      ONS Wards (December 2024) Boundaries UK BGC, London only, WGS84
  london_pp.csv          HM Land Registry Price Paid 2024-2025, Greater London rows
  pc_lsoa.csv            postcode -> LSOA21 (postcodes.io)
  imd7.csv               English Indices of Deprivation 2025, File 7
  crime_lsoa.csv         MPS LSOA Level Crime (most recent 24 months)
  pop_2023.csv, pop_2024.csv, pop_age_2024.csv   ONS small-area population estimates (Nomis NM_2014_1)
  msoanames.csv          House of Commons Library MSOA names

Usage: python3 build_london_wards.py <download_dir> <output_dir>
"""
import json
import math
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

DL = Path(sys.argv[1])
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

MIN_SALES = 20  # below this, median prices are flagged as unreliable
INPUT_QUALITY = {}


def unique_rows(frame, key, description):
    assert frame[key].notna().all() and not frame[key].duplicated().any(), f'{description}: missing or duplicate {key}'


def complete_numeric(frame, columns, description, positive=False):
    for column in columns:
        values = pd.to_numeric(frame[column], errors='raise')
        assert values.notna().all() and values.map(math.isfinite).all(), f'{description}: missing or nonfinite {column}'
        if positive:
            assert (values > 0).all(), f'{description}: nonpositive {column}'
        frame[column] = values


def complete_join(left, right, key, description):
    """Do not let missing LSOAs silently reduce sums or weighted means."""
    unique_rows(right, key, description)
    joined = left.merge(right, on=key, how='left', validate='many_to_one', indicator=True)
    missing = joined.loc[joined['_merge'] != 'both', key].tolist()
    assert not missing, f'{description}: {len(missing)} unmatched areas; examples {missing[:5]}'
    return joined.drop(columns='_merge')

# ---------- geography ----------
lk = pd.DataFrame(json.load(open(DL / "lsoa_ward_lookup.json")))
lk = lk.rename(columns={"LSOA21CD": "lsoa", "LSOA21NM": "lsoa_name", "WD24CD": "ward_code",
                        "WD24NM": "ward_name", "LAD24CD": "borough_code", "LAD24NM": "borough"})
unique_rows(lk, 'lsoa', 'Best-fit lookup')
assert lk[['ward_code', 'ward_name', 'borough_code', 'borough', 'lsoa_name']].notna().all().all(), 'Incomplete geography lookup'
lk["msoa_name"] = lk.lsoa_name.str[:-1]  # "Camden 001A" -> "Camden 001"

names = pd.read_csv(DL / "msoanames.csv", encoding="utf-8-sig")
names = names.rename(columns={"msoa21cd": "msoa_code", "msoa21nm": "msoa_name", "msoa21hclnm": "neighbourhood"})
lk = complete_join(lk, names[["msoa_code", "msoa_name", "neighbourhood"]], 'msoa_name', 'MSOA names')
assert lk.msoa_code.notna().all(), "unmatched MSOA names"

# ---------- population ----------
p24 = pd.read_csv(DL / "pop_2024.csv").rename(columns={"GEOGRAPHY_CODE": "lsoa", "OBS_VALUE": "pop_2024"})
p23 = pd.read_csv(DL / "pop_2023.csv").rename(columns={"GEOGRAPHY_CODE": "lsoa", "OBS_VALUE": "pop_2023"})
unique_rows(p24, 'lsoa', 'Mid-2024 population')
unique_rows(p23, 'lsoa', 'Mid-2023 population')
complete_numeric(p24, ['pop_2024'], 'Mid-2024 population', positive=True)
complete_numeric(p23, ['pop_2023'], 'Mid-2023 population', positive=True)
age = pd.read_csv(DL / "pop_age_2024.csv").pivot(index="GEOGRAPHY_CODE", columns="C_AGE", values="OBS_VALUE")
age = age.rename(columns={201: "age_0_15", 203: "age_16_64", 209: "age_65_plus"}).rename_axis("lsoa").reset_index()
lsoa = complete_join(lk, p24[['lsoa', 'pop_2024']], 'lsoa', 'Mid-2024 population')
lsoa = complete_join(lsoa, p23[['lsoa', 'pop_2023']], 'lsoa', 'Mid-2023 population')
lsoa = complete_join(lsoa, age[['lsoa', 'age_0_15', 'age_16_64', 'age_65_plus']], 'lsoa', 'Age structure')
complete_numeric(lsoa, ['age_0_15', 'age_16_64', 'age_65_plus'], 'Age structure')
assert (lsoa[['age_0_15', 'age_16_64', 'age_65_plus']] >= 0).all().all(), 'Negative age-group counts'
assert (lsoa[['age_0_15', 'age_16_64', 'age_65_plus']].sum(axis=1) == lsoa.pop_2024).all(), 'Age groups do not sum to population'

# ---------- deprivation (IMD 2025) ----------
imd = pd.read_csv(DL / "imd7.csv")
col = lambda s: next(c for c in imd.columns if c.startswith(s))
imd = imd[[col("LSOA code"), col("Index of Multiple Deprivation (IMD) Score"),
           col("Index of Multiple Deprivation (IMD) Decile"), col("Income Score"),
           col("Crime Score"), col("Barriers to Housing and Services Score"),
           col("Living Environment Score")]]
imd.columns = ["lsoa", "imd_score", "imd_decile", "income_score", "crime_dep_score",
               "housing_barriers_score", "living_env_score"]
lsoa = complete_join(lsoa, imd, 'lsoa', 'IoD 2025')
complete_numeric(lsoa, ['imd_score', 'imd_decile', 'income_score', 'crime_dep_score', 'housing_barriers_score', 'living_env_score'], 'IoD 2025')
assert lsoa.imd_decile.between(1, 10).all(), 'Invalid deprivation decile'

# ---------- crime (MPS; City of London is policed by CoLP, not covered) ----------
cr = pd.read_csv(DL / "crime_lsoa.csv")
months = sorted(c for c in cr.columns if c.isdigit())
assert len(months) == 24 and all(len(month) == 6 for month in months), 'Crime input must contain exactly 24 YYYYMM month columns'
parsed_months = [datetime.strptime(month, '%Y%m') for month in months]
month_numbers = [month.year * 12 + month.month for month in parsed_months]
assert all(b - a == 1 for a, b in zip(month_numbers, month_numbers[1:])), 'Crime months are not contiguous'
complete_numeric(cr, months, 'Monthly recorded crime')
assert (cr[months] >= 0).all().all(), 'Negative monthly crime counts'
last12, prev12 = months[-12:], months[-24:-12]
cr["crime_last12"] = cr[last12].sum(axis=1)
cr["crime_prev12"] = cr[prev12].sum(axis=1)
crime_tot = cr.groupby("LSOA Code")[["crime_last12", "crime_prev12"]].sum().rename_axis("lsoa").reset_index()
crime_grp = cr.groupby(["LSOA Code", "Group"]).crime_last12.sum().rename_axis(["lsoa", "group"]).reset_index()
lsoa = lsoa.merge(crime_tot, on="lsoa", how="left")
city = lsoa.borough_code == "E09000001"
assert lsoa.loc[~city, ['crime_last12', 'crime_prev12']].notna().all().all(), 'Missing non-City crime coverage; absent data must not become zero'
lsoa.loc[city, ["crime_last12", "crime_prev12"]] = float("nan")  # partial MPS records only; CoLP data not included
crime_period = f"{last12[0][:4]}-{last12[0][4:]} to {last12[-1][:4]}-{last12[-1][4:]}"

# ---------- sales ----------
pp = pd.read_csv(DL / "london_pp.csv", parse_dates=["date"])
pp = pp[pp.ppd_cat == "A"]  # standard market-value sales only
assert not pp.empty and pp.postcode.notna().all(), 'Missing sale postcodes or standard-market sales'
complete_numeric(pp, ['price'], 'Price Paid sales', positive=True)
pp['date'] = pd.to_datetime(pp['date'], errors='raise')
assert pp.date.notna().all() and set(pp.date.dt.year) == {2024, 2025}, 'Sales extract must contain both 2024 and 2025, with no other years'
postcodes = pd.read_csv(DL / 'pc_lsoa.csv').rename(columns={'lsoa21': 'lsoa'})[['postcode', 'lsoa']].drop_duplicates()
unique_rows(postcodes, 'postcode', 'Postcode-to-LSOA mapping')
pp = pp.merge(postcodes, on='postcode', how='left', validate='many_to_one')
INPUT_QUALITY['unmatched_postcode_sales_by_year'] = {str(year): int(((pp.date.dt.year == year) & pp.lsoa.isna()).sum()) for year in (2024, 2025)}
pp = pp.merge(lk[['lsoa', 'ward_code', 'msoa_code']], on='lsoa', how='left', validate='many_to_one')
INPUT_QUALITY['sales_outside_london_lookup_by_year'] = {str(year): int(((pp.date.dt.year == year) & pp.lsoa.notna() & pp.ward_code.isna()).sum()) for year in (2024, 2025)}
# Unmatched postcodes and out-of-area LSOAs are reported explicitly. They cannot
# be assigned invented areas; the published figures describe matched sales only.
pp = pp.loc[pp.ward_code.notna()].copy()
pp["year"] = pp.date.dt.year
assert set(pp.year) == {2024, 2025}, 'No mapped London sales in one of the required years'


def sales_stats(key):
    s25, s24 = pp[pp.year == 2025], pp[pp.year == 2024]
    g = s25.groupby(key).price
    out = pd.DataFrame({"sales_2025": g.size(), "median_price_2025": g.median(), "mean_price_2025": g.mean().round()})
    for t, n in {"F": "flat", "T": "terraced", "S": "semi", "D": "detached"}.items():
        out[f"median_{n}_2025"] = s25[s25.ptype == t].groupby(key).price.median()
        out[f"sales_{n}_2025"] = s25[s25.ptype == t].groupby(key).size()
    out["new_build_share_2025_pct"] = (s25.new == "Y").groupby(s25[key]).mean().mul(100).round(1)
    out["sales_2024"] = s24.groupby(key).size()
    out["median_price_2024"] = s24.groupby(key).price.median()
    out["median_change_2024_25_pct"] = ((out.median_price_2025 / out.median_price_2024 - 1) * 100).round(1)
    cnt = [c for c in out.columns if c.startswith("sales_")]
    out[cnt] = out[cnt].fillna(0).astype(int)
    out["low_sales_flag"] = out.sales_2025 < MIN_SALES
    return out.reset_index()


def area_km2(geom):
    def ring(r):
        lat0 = math.radians(sum(p[1] for p in r) / len(r))
        xy = [(p[0] * 111.320 * math.cos(lat0), p[1] * 110.574) for p in r]
        return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(xy, xy[1:] + xy[:1]))) / 2
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return sum(ring(p[0]) - sum(ring(h) for h in p[1:]) for p in polys)


def aggregate(key, name_cols):
    g = lsoa.groupby(key)
    base = g[name_cols].first()
    base["lsoa_count"] = g.size()
    sums = g[["pop_2024", "pop_2023", "age_0_15", "age_16_64", "age_65_plus"]].sum()
    df = base.join(sums)
    df["pop_change_2023_24_pct"] = ((df.pop_2024 / df.pop_2023 - 1) * 100).round(2)
    for c in ["age_0_15", "age_16_64", "age_65_plus"]:
        df[f"pct_{c}"] = (df[c] / df.pop_2024 * 100).round(1)
    w = lsoa.pop_2024
    for c in ["imd_score", "income_score", "crime_dep_score", "housing_barriers_score", "living_env_score"]:
        df[c] = (lsoa[c] * w).groupby(lsoa[key]).sum().div(g.pop_2024.sum()).round(3)
    df["pct_lsoas_most_deprived_20pct"] = (lsoa.imd_decile <= 2).groupby(lsoa[key]).mean().mul(100).round(1)
    cs = g[["crime_last12", "crime_prev12"]].sum(min_count=1)
    df = df.join(cs)
    df["crime_per_1000"] = (df.crime_last12 / df.pop_2024 * 1000).round(1)
    # A zero prior denominator has no defined percentage change; preserve null.
    df["crime_change_pct"] = ((df.crime_last12 / df.crime_prev12.replace(0, float('nan')) - 1) * 100).round(1)
    top = crime_grp.merge(lsoa[["lsoa", key]], on="lsoa").groupby([key, "group"]).crime_last12.sum().reset_index()
    top = top.sort_values("crime_last12", ascending=False).drop_duplicates(key).set_index(key)["group"]
    df["top_crime_group"] = top.str.title()
    df.loc[df.borough_code == 'E09000001', 'top_crime_group'] = None  # incomplete Met categories do not establish CoLP coverage
    df = df.reset_index().merge(sales_stats(key), on=key, how="left")
    df[["sales_2025", "sales_2024"]] = df[["sales_2025", "sales_2024"]].fillna(0).astype(int)
    df["low_sales_flag"] = df.low_sales_flag.fillna(True).astype(bool)
    return df.drop(columns=["pop_2023", "age_0_15", "age_16_64", "age_65_plus"])


# ---------- ward level ----------
ward = aggregate("ward_code", ["ward_name", "borough_code", "borough"])
hood = (lsoa.groupby(["ward_code", "neighbourhood"]).size().reset_index(name="n")
        .sort_values(["ward_code", "n"], ascending=[True, False]))
ward = ward.merge(hood.groupby("ward_code").neighbourhood.agg("; ".join).rename("neighbourhoods"), on="ward_code")

geo = json.load(open(DL / "wards_raw.geojson"))
areas = {}
for f in geo["features"]:
    areas[f["properties"]["WD24CD"]] = areas.get(f["properties"]["WD24CD"], 0) + area_km2(f["geometry"])
ward["area_km2"] = ward.ward_code.map(areas).round(3)
ward["pop_density_per_km2"] = (ward.pop_2024 / ward.area_km2).round(0)

first = ["borough", "borough_code", "ward_name", "ward_code", "neighbourhoods", "lsoa_count", "area_km2",
         "pop_2024", "pop_change_2023_24_pct", "pop_density_per_km2"]
ward = ward[first + [c for c in ward.columns if c not in first]].sort_values(["borough", "ward_name"])
ward.to_csv(OUT / "london_wards.csv", index=False)

# GeoJSON with all attributes. City of London's 25 small wards share best-fit LSOAs,
# so only wards that receive LSOAs in the lookup carry data.
rec = ward.set_index("ward_code").to_dict("index")
feats = []
for f in geo["features"]:
    code = f["properties"]["WD24CD"]
    props = {"ward_code": code, "ward_name": f["properties"]["WD24NM"], "borough": f["properties"]["LAD24NM"]}
    props.update({k: (None if (isinstance(v, float) and math.isnan(v)) else v) for k, v in rec.get(code, {}).items()})
    feats.append({"type": "Feature", "properties": props, "geometry": f["geometry"]})
json.dump({"type": "FeatureCollection", "features": feats}, open(OUT / "london_wards.geojson", "w"), separators=(",", ":"))

# ---------- neighbourhood (MSOA) level ----------
msoa = aggregate("msoa_code", ["neighbourhood", "msoa_name", "borough_code", "borough"])
first = ["borough", "borough_code", "neighbourhood", "msoa_code", "msoa_name", "lsoa_count", "pop_2024", "pop_change_2023_24_pct"]
msoa = msoa[first + [c for c in msoa.columns if c not in first]].sort_values(["borough", "neighbourhood"])
msoa.to_csv(OUT / "london_neighbourhoods.csv", index=False)

meta = {"crime_period_last12": crime_period, "sales_years": [2024, 2025], "min_sales_flag": MIN_SALES,
        "wards": len(ward), "neighbourhoods": len(msoa), "lsoas": len(lsoa),
        "sales_matched_2025": int((pp.year == 2025).sum()), "sales_matched_2024": int((pp.year == 2024).sum()),
        "input_quality": INPUT_QUALITY}
json.dump(meta, open(OUT / "build_summary.json", "w"), indent=2)
print(json.dumps(meta, indent=2))
