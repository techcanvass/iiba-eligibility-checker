# BA Certification Advisor

Get a personalized Business Analysis career path: the right certification (**ECBA, CCBA, CBAP, AAC,
CBDA, CPOA**), a step-by-step skills roadmap and matching Techcanvass courses, based on experience
and career goal. You don't need to know certification terminology.

This is the same rules engine that powers the Techcanvass BA Certification Advisor browser extension
and WordPress plugin, so it gives identical results everywhere.

```bash
pip install ba-certification-finder
```

Requires Python 3.10+. Works on Windows, macOS and Linux.

## Command line

```bash
ba-cert-finder
```

This opens a guided questionnaire (2 or 3 questions, depending on your answers) and prints your pathway.

Other commands:

```bash
# Quick hours-based ECBA / CCBA / CBAP check
ba-cert-finder check --ba-hours 5000 --pd-hours 35 --ka planning=1200 --ka elicitation=1200 --ka radd=900 --ka strategy=900

# Report for saved answers (JSON file, or - for stdin)
ba-cert-finder find answers.json
ba-cert-finder find answers.json --json

# All questions and their allowed values
ba-cert-finder questions
```

Knowledge areas for `--ka`: `planning`, `elicitation`, `lifecycle`, `strategy`, `radd`, `evaluation`.

## Python

```python
from ba_cert_finder import find_certifications, check_eligibility

report = find_certifications({
    "experience": "2to4",   # none | lt2 | 2to4 | 5plus
    "goal": "agile",        # career | agile | data | technical | ai | agents | cyber | domain | unsure
    "agile": "both",        # follow-up for the goal, see below
})
print(report["title"])
for c in report["courses"]:
    print(c["role"], "-", c["name"], c["url"])

# No BA experience yet? Ask for a background instead of a goal:
find_certifications({"experience": "none", "background": "it"})   # nonit | it | student

result = check_eligibility({
    "baHours": 5000, "pdHours": 35, "agreesToEthics": True,
    "kaHours": {"planning": 1200, "elicitation": 1200, "radd": 900, "strategy": 900},
})
print(result["recommended"])   # "CCBA"
```

Follow-up answers: goal `agile` → `agile` (`agile`/`product`/`both`); `domain` → `domain`; `data` →
`analytics` (`cert`/`hands`/`both`); `cyber` → `cyber`; `ai` or `agents` → `ai`
(`productivity`/`agents`/`both`). Goals `career`, `technical` and `unsure` need no follow-up.
Run `ba-cert-finder questions` for every allowed value.

Invalid input raises `FinderInputError` or `EligibilityInputError` (both `ValueError`). Each has an
`.errors` list of `{"field", "message"}`.

### Up-to-date rules

```python
from ba_cert_finder import load_rules, find_certifications

rules, source = load_rules("https://example.com/iiba-rules.json")   # source: "remote" or "bundled"
report = find_certifications(answers, rules=rules)
```

A hosted file is used only if it is valid and not older than the rules bundled with the package.
On the command line, use `--rules-url`.

## How it works

The certification logic is written once, in TypeScript, and compiled to a single JavaScript file.
This package runs that exact file in Google's V8 engine (via `mini-racer`). It contains no logic of
its own, so a rule change in the shared core reaches every platform.

---

Independent guidance based on published IIBA and PMI criteria. Final eligibility is determined by the
certification body. IIBA®, BABOK®, ECBA™, CCBA®, CBAP®, CBDA®, AAC® and CCA® are trademarks of the
International Institute of Business Analysis. PMI-PBA® is a mark of the Project Management Institute.
This package is not affiliated with or endorsed by IIBA or PMI.
