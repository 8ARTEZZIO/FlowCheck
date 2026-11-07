import json
import os
from pathlib import Path

from .core import join_areas, load_json


def main():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set DATABASE_URL before seeding PostgreSQL.")
    import psycopg
    from psycopg.types.json import Jsonb
    areas = join_areas()
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS flowcheck_areas (code text PRIMARY KEY CHECK (code ~ '^E090000[0-9]{2}$'), document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())")
        conn.execute("CREATE TABLE IF NOT EXISTS flowcheck_datasets (name text PRIMARY KEY, document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())")
        for area in areas:
            conn.execute("INSERT INTO flowcheck_areas (code, document) VALUES (%s, %s) ON CONFLICT (code) DO UPDATE SET document = EXCLUDED.document, updated_at = now()", (area["code"], Jsonb(area)))
        for name in ["evidence", "market", "policy"]:
            conn.execute("INSERT INTO flowcheck_datasets (name, document) VALUES (%s, %s) ON CONFLICT (name) DO UPDATE SET document = EXCLUDED.document, updated_at = now()", (name, Jsonb(load_json(name))))
    print(json.dumps({"seeded_areas": len(areas), "snapshot": "2025"}))


if __name__ == "__main__":
    main()
