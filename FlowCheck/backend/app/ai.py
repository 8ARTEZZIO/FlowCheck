import json
import os
import re

import httpx


async def enhance_brief(baseline, area):
    """Optional interpretation; all numeric facts and actions remain deterministic."""
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return baseline
    schema = {
        "type": "object",
        "properties": {
            "interpretation": {"type": "string"},
            "source_ids": {"type": "array", "items": {"type": "string", "enum": ["market", "migration", "hdt", "vacancy"]}},
        },
        "required": ["interpretation", "source_ids"],
        "additionalProperties": False,
    }
    evidence = {key: area[key] for key in ["borough", "population_change_2024_25_midyear", "internal_net_2024_25_midyear", "international_net_2024_25_midyear", "hdt_2025_pct", "longterm_empty_2025_10_06", "historical_annualized_index_volatility_36m_pct"]}
    request = {
        "model": os.getenv("OPENAI_MODEL", "gpt-5-mini"),
        "store": False,
        "max_output_tokens": 800,
        "instructions": "Write a short qualitative interpretation of an area-level historical housing screen. Use only the provided evidence. Phrase the result as questions to investigate. Do not repeat numbers, estimate returns, imply causation, label an investment safe, or infer foreign ownership. Do not offer a buy/sell recommendation. Use only supplied source identifiers. Maximum three sentences. All factual numbers will be printed separately by the application.",
        "input": json.dumps({"public_area_evidence": evidence, "allowed_next_steps": baseline["next_steps"]}),
        "text": {"format": {"type": "json_schema", "name": "flowcheck_interpretation", "strict": True, "schema": schema}},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post("https://api.openai.com/v1/responses", headers={"Authorization": f"Bearer {api_key}"}, json=request)
            response.raise_for_status()
            payload = response.json()
        output = "".join(part.get("text", "") for item in payload.get("output", []) if item.get("type") == "message" for part in item.get("content", []) if part.get("type") == "output_text")
        parsed = json.loads(output)
        if not isinstance(parsed.get("interpretation"), str) or not isinstance(parsed.get("source_ids"), list):
            return baseline
        interpretation = parsed["interpretation"].strip()
        allowed_sources = set(baseline["source_ids"])
        if not interpretation or len(interpretation) > 1000 or re.search(r"\d|£|\$|\bROI\b|guaranteed return", interpretation, re.I) or not parsed["source_ids"] or not set(parsed["source_ids"]).issubset(allowed_sources):
            return baseline
        return {**baseline, "summary": baseline["summary"] + "\n\n" + interpretation, "mode": "openai"}
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return baseline
