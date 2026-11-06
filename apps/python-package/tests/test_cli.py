import io
import json
import subprocess
import sys

from ba_cert_finder.cli import main


def run(argv, stdin=""):
    out = io.StringIO()
    code = main(argv, stdin=io.StringIO(stdin), stdout=out)
    return code, out.getvalue()


def test_check_json():
    code, out = run(["check", "--ba-hours", "8000", "--pd-hours", "35", "--ka", "planning=1000",
                     "--ka", "elicitation=1000", "--ka", "radd=1000", "--ka", "strategy=1000", "--json",
                     "--as-of", "2026-10-31"])
    assert code == 0 and json.loads(out)["recommended"] == "CBAP"


def test_check_text_shows_gaps():
    code, out = run(["check", "--ba-hours", "1000", "--pd-hours", "10", "--as-of", "2026-10-31"])
    assert code == 0
    assert "Recommended: ECBA" in out and "2,750 more BA work hours needed" in out


def test_check_invalid_returns_2(capsys):
    code, _ = run(["check", "--ba-hours", "-5", "--pd-hours", "0"])
    assert code == 2 and "BA hours must be a number" in capsys.readouterr().err


def test_find_from_stdin_json():
    answers = {"totalYears": 0, "background": "student", "education": "bachelor", "interest": "data",
               "activities": [], "baYears": None, "baShare": None, "continuity": None, "recent": None}
    code, out = run(["find", "-", "--json"], stdin=json.dumps(answers))
    assert code == 0 and json.loads(out)["matches"][0]["code"] == "CBDA"


def test_questions_come_from_shared_rules():
    code, out = run(["questions"])
    data = json.loads(out)
    assert code == 0 and len(data["activities"]) == 10
    assert data["questions"]["totalYears"]["label"] == "Total professional work experience"


def test_interactive_guided_finder():
    # Step 1: 5–7 yrs, BA, Enter (default edu), 2 = Business Analysis
    # Step 2: activities 1,2,5,7; 5–7 yrs; 50–80%; continuous; still do them; no precise check
    script = "\n".join(["5", "1", "", "2", "1,2,5,7", "5", "3", "1", "1", "n"]) + "\n"
    code, out = run([], stdin=script)
    assert code == 0
    assert "You selected 4 everyday work activities spanning 4 of 6 analysis areas" in out
    assert out.index("CCBA —") < out.index("CBAP —") < out.index("ECBA —")


def test_interactive_reprompts_required_and_bad_input():
    script = "\n".join(["", "99", "1", "1", "", "", "", "", "", "", "", "", "n"]) + "\n"
    code, out = run([], stdin=script)
    assert code == 0
    assert "This question is required." in out and "Please enter one of the numbers above." in out


def test_interactive_precise_check():
    steps = ["6", "1", "", "", "1,2,3,4,5,6,7,8,9,10", "7", "4", "1", "1", "y"]
    steps += ["4000", "900", "900", "0", "0", "0", "0"]        # CCBA: 7-year total + 6 areas
    steps += ["8000", "1000", "1000", "1000", "1000", "0", "0"]  # CBAP: 10-year total + 6 areas
    code, out = run([], stdin="\n".join(steps) + "\n")
    assert code == 0 and out.count("Experience thresholds indicated") == 2


def test_interactive_end_of_input_exits_cleanly():
    code, _ = run([], stdin="")
    assert code == 130


def test_real_process_exits_promptly():
    """Guards the V8 shutdown fix: the CLI must exit, not hang."""
    r = subprocess.run([sys.executable, "-m", "ba_cert_finder", "check", "--ba-hours", "4000", "--pd-hours", "21",
                        "--ka", "planning=900", "--ka", "radd=900", "--json"],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0 and json.loads(r.stdout)["recommended"] == "CCBA"
