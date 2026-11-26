"""Command-line interface: ``ba-cert-finder``.

    ba-cert-finder                      guided advisor (asks the same questions as the website)
    ba-cert-finder find answers.json    report for saved answers ("-" reads stdin)
    ba-cert-finder check --ba-hours 5000 --pd-hours 35 --ka planning=900 --ka radd=900
    ba-cert-finder questions            questions and allowed values, as JSON

Add --json to ``find``/``check`` for machine-readable output, and --rules-url to use hosted rules.
Every question, option and rule comes from the shared rules file, not from this script.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Callable, TextIO

from . import BACertFinderError, __version__, check_eligibility, find_certifications, load_rules

ROLE = {"primary": "PRIMARY RECOMMENDATION", "also": "ALSO RECOMMENDED", "optional": "OPTIONAL / COMPLEMENTARY"}
FOLLOW_UP = {"agile": "agile", "domain": "domain", "data": "analytics", "cyber": "cyber", "ai": "ai", "agents": "ai"}


class _IO:
    def __init__(self, stdin: TextIO, stdout: TextIO):
        self.stdin, self.stdout = stdin, stdout

    def say(self, text: str = "") -> None:
        print(text, file=self.stdout)

    def ask(self, prompt: str) -> str:
        self.stdout.write(prompt)
        self.stdout.flush()
        line = self.stdin.readline()
        if line == "":
            raise EOFError
        return line.strip()


def _choose(io: _IO, key: str, q: dict, required: bool) -> Any:
    io.say()
    io.say(q["label"])
    for i, opt in enumerate(q["options"], 1):
        mark = "  (default)" if opt["value"] == q.get("default") else ""
        io.say(f"  {i}. {opt['label']}{mark}")
    if q.get("hint"):
        io.say(f"  {q['hint']}")
    skip = "" if required else ("  [Enter = default]" if "default" in q else "  [Enter = skip]")
    while True:
        raw = io.ask(f"Choose 1-{len(q['options'])}{skip}: ")
        if raw == "" and not required:
            return q.get("default")
        if raw.isdigit() and 1 <= int(raw) <= len(q["options"]):
            return q["options"][int(raw) - 1]["value"]
        io.say("  Please enter one of the numbers above." if raw else "  This question is required.")


def _print_report(io: _IO, report: dict) -> None:
    io.say()
    io.say("=" * 72)
    io.say(report["title"])
    io.say("=" * 72)
    io.say(report["intro"])
    io.say()
    io.say("Your step-by-step learning roadmap")
    for i, step in enumerate(report["roadmap"], 1):
        io.say(f"  {i}. {step}")
    io.say()
    io.say("Recommended certification and courses")
    for c in report["courses"]:
        io.say(f"  [{ROLE[c['role']]}] {c['name']}")
        io.say(f"    {c['desc']}")
        if c.get("issuerUrl"):
            io.say(f"    Credential at {c['issuer']}: {c['issuerUrl']}")
        io.say(f"    {c['url']}")
    io.say()
    io.say("Why this recommendation?")
    io.say(f"  {report['reason']}")
    for point in report["why"]:
        io.say(f"  - {point}")
    io.say()
    io.say(f"Eligibility & scope: {report['notice']}")
    io.say()
    io.say("Recommendations are guidance, not a guarantee of exam eligibility, admission or employment.")
    io.say(f"Confirm current official requirements before applying. Rules v{report['rulesVersion']}.")


def _print_check(io: _IO, report: dict) -> None:
    io.say(f"Recommended: {report['recommended'] or 'none yet'}")
    for w in report["warnings"]:
        io.say(f"! {w}")
    for r in report["results"]:
        io.say()
        io.say(f"{'✓' if r['eligible'] else '✗'} {r['code']} — {'Eligible' if r['eligible'] else 'Not yet'}")
        for q in r["requirements"]:
            io.say(f"   {'✓' if q['met'] else '✗'} {q['label'] if q['met'] else q['gap']}")
        if r.get("projectedEligibleOn"):
            io.say(f"   Work-hours rule met around {r['projectedEligibleOn']} at your current pace.")


def _ask(io: _IO, q: dict, options: list[dict] | None = None) -> str:
    """Ask one advisor question; the title, helper text and options all come from the rules."""
    return _choose(io, "", {"label": q["title"], "hint": q["helper"], "options": options or q["options"]}, required=True)


def _interactive(io: _IO, rules: dict) -> int:
    a = rules["advisor"]
    qs = a["questions"]
    io.say("BA Certification Advisor — find the right Business Analysis path")
    answers: dict[str, Any] = {"experience": _ask(io, qs["experience"])}
    if answers["experience"] == "none":
        answers["background"] = _ask(io, qs["background"])
    else:
        goals = [g for g in a["goals"] if answers["experience"] not in g.get("hideFor", [])]
        answers["goal"] = _ask(io, {"title": "What is your next career goal?",
                                    "helper": "Choose the outcome that matters most to you right now."}, goals)
        follow = FOLLOW_UP.get(answers["goal"])
        if follow:
            answers[follow] = _ask(io, qs[follow])
    _print_report(io, find_certifications(answers, rules=rules))
    return 0


def _ka_arg(text: str) -> tuple[str, float]:
    area, sep, hours = text.partition("=")
    if not sep:
        raise argparse.ArgumentTypeError("use AREA=HOURS, e.g. planning=900")
    try:
        return area.strip(), float(hours)
    except ValueError:
        raise argparse.ArgumentTypeError(f"hours must be a number in {text!r}") from None


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ba-cert-finder", description="Find the right Business Analyst certification.")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    p.add_argument("--rules-url", help="hosted rules JSON (falls back to the bundled rules)")
    sub = p.add_subparsers(dest="command")

    f = sub.add_parser("find", help="report for saved answers (JSON file, or - for stdin)")
    f.add_argument("answers", help="path to answers JSON, or -")
    f.add_argument("--json", action="store_true", help="print the report as JSON")

    c = sub.add_parser("check", help="quick hours-based ECBA / CCBA / CBAP check")
    c.add_argument("--ba-hours", type=float, required=True, help="BA work hours in the last 10 years")
    c.add_argument("--pd-hours", type=float, required=True, help="professional development hours, last 4 years")
    c.add_argument("--ka", type=_ka_arg, action="append", default=[], metavar="AREA=HOURS",
                   help="hours per knowledge area: planning, elicitation, lifecycle, strategy, radd, evaluation")
    c.add_argument("--references", type=int, help="number of professional references")
    c.add_argument("--no-ethics", action="store_true", help="has NOT agreed to the IIBA Code of Ethical Conduct")
    c.add_argument("--as-of", help="check as of this date (YYYY-MM-DD)")
    c.add_argument("--json", action="store_true", help="print the result as JSON")

    sub.add_parser("questions", help="print questions and allowed values as JSON")
    return p


def main(argv: list[str] | None = None, stdin: TextIO | None = None, stdout: TextIO | None = None) -> int:
    stdout = stdout or sys.stdout
    if hasattr(stdout, "reconfigure"):
        try:  # don't crash on consoles that can't print ✓ or —
            stdout.reconfigure(errors="replace")
        except (ValueError, OSError):
            pass
    io = _IO(stdin or sys.stdin, stdout)
    args = _parser().parse_args(argv)
    rules, _source = load_rules(args.rules_url)
    emit: Callable[[Any], None] = lambda obj: io.say(json.dumps(obj, indent=2, ensure_ascii=False))

    try:
        if args.command == "questions":
            a = rules["advisor"]
            emit({"questions": a["questions"], "goals": a["goals"],
                  "knowledgeAreas": rules["knowledgeAreas"], "rulesVersion": rules["version"]})
            return 0
        if args.command == "find":
            text = io.stdin.read() if args.answers == "-" else open(args.answers, encoding="utf-8").read()
            report = find_certifications(json.loads(text), rules=rules)
            emit(report) if args.json else _print_report(io, report)
            return 0
        if args.command == "check":
            candidate: dict[str, Any] = {
                "baHours": args.ba_hours,
                "pdHours": args.pd_hours,
                "kaHours": dict(args.ka),
                "agreesToEthics": not args.no_ethics,
            }
            if args.references is not None:
                candidate["references"] = args.references
            if args.as_of:
                candidate["asOf"] = args.as_of
            result = check_eligibility(candidate, rules=rules)
            emit(result) if args.json else _print_check(io, result)
            return 0
        return _interactive(io, rules)
    except BACertFinderError as e:
        for err in e.errors or [{"message": str(e)}]:
            print(f"error: {err.get('field', '') + ': ' if err.get('field') else ''}{err['message']}", file=sys.stderr)
        return 2
    except (OSError, json.JSONDecodeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    except (EOFError, KeyboardInterrupt):
        io.say()
        return 130
