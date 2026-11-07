import os
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from time import monotonic

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

from .ai import enhance_brief
from .core import Profile, evidence_brief, load_json, match_areas, thresholds
from .repository import AreaRepository


@asynccontextmanager
async def lifespan(app):
    app.state.repository = AreaRepository()
    yield


app = FastAPI(title="FlowCheck API", version="1.0.0", description="Deterministic historical area screening with optional AI interpretation.", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[v.strip() for v in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:8080").split(",") if v.strip()], allow_methods=["GET", "POST"], allow_headers=["Content-Type"], allow_credentials=False)
brief_requests = defaultdict(deque)


class BriefRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(pattern=r"^E090000[0-9]{2}$")
    profile: Profile


@app.middleware("http")
async def response_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store" if request.method == "POST" else "public, max-age=60"
    return response


@app.get("/api/health")
def health(request: Request):
    try:
        return request.app.state.repository.health()
    except Exception:
        raise HTTPException(503, "The configured evidence store is unavailable or incomplete.") from None


def get_areas(request):
    try:
        return request.app.state.repository.areas()
    except Exception:
        raise HTTPException(503, "The configured evidence store is unavailable or incomplete.") from None


@app.get("/api/areas")
def areas(request: Request):
    return {"areas": get_areas(request), "policy": load_json("policy"), "sources": request.app.state.repository.sources()}


@app.post("/api/match")
def match(profile: Profile, request: Request):
    area_rows = get_areas(request)
    policy = load_json("policy")
    matches = match_areas(area_rows, profile, policy)
    return {"areas": matches, "matched_count": sum(a["matches"] for a in matches), "variability_cap_pct": thresholds(area_rows, policy)[profile.appetite], "profile": profile.model_dump(), "snapshot": "2025"}


@app.post("/api/brief")
async def brief(body: BriefRequest, request: Request):
    # Budget/allowance values stay in the deterministic service, not the model prompt.
    client = request.client.host if request.client else "unknown"
    now = monotonic()
    if len(brief_requests) > 2048:
        stale = [key for key, times in brief_requests.items() if not times or times[-1] < now - 60]
        for key in stale:
            brief_requests.pop(key, None)
    times = brief_requests[client]
    while times and times[0] < now - 60:
        times.popleft()
    if len(times) >= 20:
        raise HTTPException(429, "Please wait before generating another brief.", headers={"Retry-After": "60"})
    times.append(now)
    selected = next((a for a in match_areas(get_areas(request), body.profile) if a["code"] == body.code), None)
    if not selected:
        raise HTTPException(404, "Unknown local authority code.")
    return await enhance_brief(evidence_brief(selected, body.profile), selected)
