import json
import sys
import unittest
from pathlib import Path
from unittest.mock import call, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import smoke_test


class SmokeTest(unittest.TestCase):
    @patch("smoke_test.get")
    def test_checks_health_ui_and_unauthenticated_api(self, get):
        get.side_effect = [
            (200, json.dumps({"success": True, "data": {"status": "ok", "database": "up"}}).encode()),
            (200, b"<!doctype html><html></html>"),
            (401, b"unauthorized"),
        ]

        smoke_test.check("https://survey.example")

        self.assertEqual(
            get.call_args_list,
            [
                call("https://survey.example", "/api/health"),
                call("https://survey.example", "/"),
                call("https://survey.example", "/api/surveys"),
            ],
        )

    def test_rejects_non_http_service_url(self):
        with self.assertRaises(ValueError):
            smoke_test.check("file:///etc/passwd")


if __name__ == "__main__":
    unittest.main()
