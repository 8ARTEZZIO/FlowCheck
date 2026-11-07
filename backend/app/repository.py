import os

from .core import join_areas, load_json


class AreaRepository:
    """Read published aggregate evidence; customer profiles are never persisted."""

    def __init__(self):
        self.database_url = os.getenv("DATABASE_URL", "")
        self.file_areas = join_areas()

    @property
    def mode(self):
        return "postgresql" if self.database_url else "bundled_snapshot"

    def areas(self):
        if not self.database_url:
            return self.file_areas
        import psycopg
        with psycopg.connect(self.database_url, connect_timeout=5) as conn:
            rows = conn.execute("SELECT document FROM flowcheck_areas ORDER BY code").fetchall()
        areas = [row[0] for row in rows]
        if len(areas) != 33 or len({r["code"] for r in areas}) != 33:
            raise RuntimeError("PostgreSQL snapshot is incomplete; run python -m app.seed.")
        return areas

    def health(self):
        return {"status": "ok", "storage": self.mode, "area_count": len(self.areas()), "snapshot": "2025"}

    def sources(self):
        evidence, market = load_json("evidence"), load_json("market")
        return {**evidence["sources"], "market": market["metadata"]}
