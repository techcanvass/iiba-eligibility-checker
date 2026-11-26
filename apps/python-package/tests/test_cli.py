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
    code, out = run(["find", "-", "--json"], stdin=json.dumps({"experience": "lt2", "goal": "data", "analytics": "cert"}))
    assert code == 0 and json.loads(out)["courses"][0]["key"] == "cbda"


def test_find_text_report():
    code, out = run(["find", "-"], stdin=json.dumps({"experience": "5plus", "goal": "career"}))
    assert code == 0
    assert "BABOK" in out or "roadmap" in out
    assert "[PRIMARY RECOMMENDATION] IIBA CBAP Certification Training" in out
    assert "7,500 qualifying BA work hours" in out


def test_find_invalid_answers_return_2(capsys):
    code, _ = run(["find", "-"], stdin=json.dumps({"experience": "2to4"}))
    assert code == 2 and "goal: Please choose an answer." in capsys.readouterr().err


def test_questions_come_from_shared_rules():
    code, out = run(["questions"])
    data = json.loads(out)
    assert code == 0 and len(data["goals"]) == 9
    assert data["questions"]["experience"]["title"].startswith("How much hands-on Business Analysis experience")


def test_interactive_beginner_path():
    # experience: 1 = none, background: 2 = IT
    code, out = run([], stdin="1\n2\n")
    assert code == 0
    assert "BA foundation + ECBA" in out and "[OPTIONAL / COMPLEMENTARY] Domain Training Courses" in out


def test_interactive_agile_path_asks_a_follow_up():
    # experience 3 = 2-4 yrs; goal 2 = Agile BA / Product Owner; follow-up 3 = both
    code, out = run([], stdin="3\n2\n3\n")
    assert code == 0
    assert "Which Agile / product career direction interests you more?" in out
    assert "Agile Analysis + Product Ownership" in out


def test_interactive_goal_list_is_filtered_by_experience():
    # 5+ years: data and technical are not offered, so 9 goals become 7
    code, out = run([], stdin="4\n1\n")
    assert code == 0
    assert "Specialize in Data Analytics" not in out and "Build Technical BA skills" not in out


def test_interactive_reprompts_required_and_bad_input():
    code, out = run([], stdin="\n99\n1\n1\n")
    assert code == 0
    assert "This question is required." in out and "Please enter one of the numbers above." in out


def test_interactive_end_of_input_exits_cleanly():
    code, _ = run([], stdin="")
    assert code == 130


def test_real_process_exits_promptly():
    """Guards the V8 shutdown fix: the CLI must exit, not hang."""
    r = subprocess.run([sys.executable, "-m", "ba_cert_finder", "check", "--ba-hours", "4000", "--pd-hours", "21",
                        "--ka", "planning=900", "--ka", "radd=900", "--json"],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0 and json.loads(r.stdout)["recommended"] == "CCBA"
