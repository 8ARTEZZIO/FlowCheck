import json
import math
import os
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

DATA_DIR = Path(os.getenv("FLOWCHECK_DATA_DIR", Path(__file__).resolve().parents[2] / "public" / "data"))


class Profile(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, strict=True)
    capital: float = Field(gt=0, le=1e12)
    appetite: Literal["conservative", "balanced", "ambitious"] = "balanced"
    works_allowance: float = Field(default=50000, ge=0, le=1e8)
    reserve_percent: float = Field(default=10, ge=0, le=100)
    homes: int = Field(default=1, ge=1, le=1000, strict=True)
    focus: Literal["growth", "vacancy", "delivery"] = "growth"


def load_json(name):
    return json.loads((DATA_DIR / f"{name}.json").read_text())


def money(value):
    return math.floor(value * 100 + 0.5 + 1e-7) / 100


def thresholds(areas, policy):
    values = [a["historical_annualized_index_volatility_36m_pct"] for a in areas]
    if not values or not all(math.isfinite(v) for v in values):
        raise ValueError("Historical variability data is incomplete.")
    maximum = max(values)
    return {key: item["max_pct"] if item["max_pct"] is not None else maximum for key, item in policy["appetites"].items()}


def join_areas(evidence=None, market=None, policy=None):
    evidence = evidence or load_json("evidence")
    market = market or load_json("market")
    policy = policy or load_json("policy")
    source_rows = evidence["boroughs"]
    if len(source_rows) != 33 or len({r["code"] for r in source_rows}) != 33 or len(market["boroughs"]) != 33:
        raise ValueError("The 33-area source join is incomplete.")
    areas = []
    for e in source_rows:
        m = market["boroughs"].get(e["code"])
        if not m or not math.isfinite(m["average_price_gbp"]) or m["average_price_gbp"] <= 0 or not math.isfinite(m["historical_annualized_index_volatility_36m_pct"]) or m["historical_log_return_observations"] != 36:
            raise ValueError(f"Market evidence is missing for {e['borough']}.")
        areas.append({**e, **m})
    for area in areas:
        vol = area["historical_annualized_index_volatility_36m_pct"]
        area["risk_band"] = "conservative" if vol <= 5 else "balanced" if vol < 15 else "ambitious"
    return areas


def match_areas(areas, profile: Profile, policy=None):
    policy = policy or load_json("policy")
    cap = thresholds(areas, policy)[profile.appetite]
    results = []
    for area in areas:
        required = money(profile.homes * (area["average_price_gbp"] + profile.works_allowance) * (1 + profile.reserve_percent / 100))
        budget_fits = profile.capital >= required
        risk_fits = area["risk_band"] == profile.appetite
        reasons = []
        if not budget_fits:
            reasons.append("Above your capital benchmark")
        if not risk_fits:
            reasons.append("Above your historical-variability cap")
        results.append({**area, "required_capital": required, "budget_fits": budget_fits, "risk_fits": risk_fits, "matches": budget_fits and risk_fits, "capital_headroom": money(profile.capital - required), "budget_gap": money(max(0, required - profile.capital)), "exclusion_reasons": reasons})
    if profile.focus == "vacancy":
        key = lambda a: (not a["matches"], -a["longterm_empty_2025_10_06"], a["borough"])
    elif profile.focus == "delivery":
        key = lambda a: (not a["matches"], a["hdt_2025_pct"], -a["population_change_2024_25_midyear"])
    else:
        key = lambda a: (not a["matches"], -a["population_change_2024_25_midyear"], a["borough"])
    return sorted(results, key=key)


def evidence_brief(area, profile: Profile):
    steps = []
    if area["population_change_2024_25_midyear"] > 0 and area["hdt_2025_pct"] < 95:
        steps.append("Compare permissions, starts and completions to locate delivery constraints; verify local household and tenure needs.")
    if area["internal_net_2024_25_midyear"] < 0:
        steps.append("Investigate destinations and reasons for domestic outflows before interpreting international inflows as additional household demand.")
    if area["longterm_empty_2025_10_06"] > 0:
        steps.append("Check which recorded long-term empty homes are habitable, available and practical to return to use.")
    steps.append("Obtain a property-specific price, survey, tax and works budget before allocating capital.")
    population = f"{area['population_change_2024_25_midyear']:+,}"
    required = area["required_capital"]
    budget_text = f"£{required:,.0f}" if float(required).is_integer() else f"£{required:,.2f}"
    return {
        "title": f"{area['borough']}: area screening brief",
        "summary": f"The indicative budget for {profile.homes} {'home' if profile.homes == 1 else 'homes'} is {budget_text}, using the March 2025 borough-average price and your works and reserve assumptions. Historical annualised HPI variability is {area['historical_annualized_index_volatility_36m_pct']:.2f}%. Population changed by {population} in the year to mid-2025; the 2025 Housing Delivery Test result is {area['hdt_2025_pct']}% of its three-year requirement. The October 2025 snapshot records {area['longterm_empty_2025_10_06']:,} long-term empty dwellings.",
        "next_steps": steps[:4],
        "caveat": "This is an area-level historical screen. It does not establish investment returns, property availability, construction costs, recoverable vacancies or a causal migration effect.",
        "source_ids": ["market", "migration", "hdt", "vacancy"],
        "mode": "evidence_template",
    }
