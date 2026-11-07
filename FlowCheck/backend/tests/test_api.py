import copy
import os
import unittest
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core import Profile, join_areas, load_json, match_areas
from app.main import app, brief_requests
from app.ai import enhance_brief


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.environ = patch.dict(os.environ, {"DATABASE_URL": "", "OPENAI_API_KEY": ""})
        self.environ.start()
        brief_requests.clear()
        self.client = TestClient(app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.environ.stop()

    def test_health_and_area_coverage(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["area_count"], 33)
        self.assertEqual(len(self.client.get("/api/areas").json()["areas"]), 33)

    def test_cash_and_appetite_intersection(self):
        result = self.client.post("/api/match", json={"capital": 500000, "appetite": "conservative"})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["matched_count"], 1)
        self.assertEqual(next(a for a in result.json()["areas"] if a["matches"])["borough"], "Barking and Dagenham")

    def test_input_rejection(self):
        for profile in [{"capital": -1}, {"capital": 1e13}, {"capital": True}, {"capital": "500000"}, {"capital": 500000, "homes": 1.5}, {"capital": 500000, "appetite": "safe"}, {"capital": 500000, "reserve_percent": -1}, {"capital": 500000, "extra": "unexpected"}]:
            with self.subTest(profile=profile):
                self.assertEqual(self.client.post("/api/match", json=profile).status_code, 422)

    def test_brief_works_without_a_key(self):
        response = self.client.post("/api/brief", json={"code": "E09000016", "profile": {"capital": 1000000}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mode"], "evidence_template")
        self.assertIn("£549,728.30", response.json()["summary"])
        self.assertIn("40%", response.json()["summary"])

    def test_unknown_and_invalid_codes(self):
        self.assertEqual(self.client.post("/api/brief", json={"code": "E09000099", "profile": {"capital": 1000000}}).status_code, 404)
        self.assertEqual(self.client.post("/api/brief", json={"code": "';drop table", "profile": {"capital": 1000000}}).status_code, 422)

    def test_post_response_does_not_cache_profiles(self):
        response = self.client.post("/api/match", json={"capital": 1000000})
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_unavailable_configured_store_is_visible(self):
        with patch.object(app.state.repository, "areas", side_effect=RuntimeError("database connection details must not leak")):
            response = self.client.get("/api/health")
            self.assertEqual(response.status_code, 503)
            self.assertNotIn("connection details", response.text)

    def test_brief_rate_limit(self):
        for _ in range(20):
            response = self.client.post("/api/brief", json={"code": "E09000016", "profile": {"capital": 1000000}})
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.post("/api/brief", json={"code": "E09000016", "profile": {"capital": 1000000}}).status_code, 429)


class CoreTests(unittest.TestCase):
    def test_known_source_control_totals(self):
        areas = join_areas()
        self.assertEqual(sum(a["population_change_2024_25_midyear"] for a in areas), -26737)
        self.assertEqual(sum(a["net_additions_fy2024_25"] for a in areas), 32678)
        self.assertEqual(sum(a["longterm_empty_2025_10_06"] for a in areas), 47287)

    def test_incomplete_data_does_not_become_zero(self):
        market = copy.deepcopy(load_json("market"))
        del market["boroughs"]["E09000016"]
        with self.assertRaises(ValueError):
            join_areas(market=market)

    def test_nonfinite_profile_rejected(self):
        for value in [float("nan"), float("inf")]:
            with self.assertRaises(ValidationError):
                Profile(capital=value)


class AiTests(unittest.IsolatedAsyncioTestCase):
    async def test_no_api_key_means_no_external_call(self):
        baseline = {"summary": "Verified facts", "source_ids": ["market"], "next_steps": [], "mode": "evidence_template"}
        with patch.dict(os.environ, {"OPENAI_API_KEY": ""}), patch("httpx.AsyncClient") as client:
            self.assertEqual(await enhance_brief(baseline, {}), baseline)
            client.assert_not_called()


if __name__ == "__main__":
    unittest.main()
