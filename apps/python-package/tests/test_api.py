import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

import ba_cert_finder as bcf

ANSWERS = {
    "totalYears": 6, "background": "ba", "education": "bachelor", "interest": "general",
    "activities": [0, 1, 4, 6], "baYears": 6, "baShare": 0.7, "continuity": "continuous", "recent": "current",
}


def test_find_certifications_returns_all_seven():
    report = bcf.find_certifications(ANSWERS)
    assert [m["code"] for m in report["matches"]][:3] == ["CCBA", "CBAP", "ECBA"]
    assert len(report["matches"]) == 7


def test_finder_error_has_field_details():
    with pytest.raises(bcf.FinderInputError) as e:
        bcf.find_certifications({**ANSWERS, "totalYears": None})
    assert e.value.errors[0]["field"] == "totalYears"


def test_check_eligibility_and_error_type():
    r = bcf.check_eligibility({"asOf": "2026-10-31", "baHours": 1000, "pdHours": 10, "agreesToEthics": True})
    assert r["recommended"] == "ECBA"
    with pytest.raises(bcf.EligibilityInputError):
        bcf.check_eligibility({"baHours": -5, "agreesToEthics": True})
    assert issubclass(bcf.EligibilityInputError, ValueError)


def test_bundled_rules_is_a_copy():
    a = bcf.bundled_rules()
    a["version"] = "changed"
    assert bcf.bundled_rules()["version"] != "changed"


def test_custom_rules_are_used():
    rules = bcf.bundled_rules()
    rules["finder"]["certifications"][0]["description"] = "Custom ECBA text"
    report = bcf.find_certifications({**ANSWERS, "interest": "unsure"}, rules=rules)
    assert report["matches"][0]["description"] == "Custom ECBA text"


def test_thread_safe_concurrent_calls():
    results, errors = [], []

    def work():
        try:
            results.append(bcf.find_certifications(ANSWERS)["matches"][0]["code"])
        except Exception as exc:  # pragma: no cover
            errors.append(exc)

    threads = [threading.Thread(target=work) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors and results == ["CCBA"] * 8


@pytest.fixture
def rules_server():
    """Local HTTP server returning whatever `payload` is set to."""
    state = {"payload": b"{}", "status": 200}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(state["status"])
            self.end_headers()
            self.wfile.write(state["payload"])

        def log_message(self, *a):
            pass

    srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield state, f"http://127.0.0.1:{srv.server_address[1]}/rules.json"
    srv.shutdown()


def test_load_rules_remote_newer(rules_server):
    state, url = rules_server
    newer = bcf.bundled_rules()
    newer["version"] = "2099.1.0"
    state["payload"] = json.dumps(newer).encode()
    rules, source = bcf.load_rules(url)
    assert source == "remote" and rules["version"] == "2099.1.0"


@pytest.mark.parametrize(
    "payload,status",
    [(b"not json", 200), (b'{"version":"9999"}', 200), (b"{}", 500)],
    ids=["bad-json", "invalid-schema", "http-500"],
)
def test_load_rules_falls_back(rules_server, payload, status):
    state, url = rules_server
    state["payload"], state["status"] = payload, status
    rules, source = bcf.load_rules(url)
    assert source == "bundled" and rules["version"] == bcf.bundled_rules()["version"]


def test_load_rules_older_remote_ignored(rules_server):
    state, url = rules_server
    old = bcf.bundled_rules()
    old["version"] = "2020.1.0"
    state["payload"] = json.dumps(old).encode()
    assert bcf.load_rules(url)[1] == "bundled"


def test_load_rules_unreachable():
    assert bcf.load_rules("http://127.0.0.1:9/nothing.json", timeout=1)[1] == "bundled"
