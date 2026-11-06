"""Replays the shared golden cases from packages/core/tests/conformance.

Passing proves Python gives *exactly* the same results as the TypeScript core used by the
browser extension, WordPress plugin and web app — because it runs the same compiled file.
"""

import json
from pathlib import Path

import pytest

from ba_cert_finder import _engine

CONFORMANCE = Path(__file__).resolve().parents[3] / "packages" / "core" / "tests" / "conformance"
CASES = json.loads((CONFORMANCE / "cases.json").read_text(encoding="utf-8"))["cases"]
GOLDEN = json.loads((CONFORMANCE / "expected.json").read_text(encoding="utf-8"))


def test_bundled_rules_match_golden_version():
    assert json.loads(_engine.bundled_rules_text())["version"] == GOLDEN["rulesVersion"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_same_result_as_typescript(case):
    assert _engine.call(case["fn"], case["input"]) == GOLDEN["results"][case["name"]]
