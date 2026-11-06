# BA Certification Finder

Find the right Business Analyst certification (**ECBA, CCBA, CBAP, CBDA, AAC, CCA or PMI-PBA**) from
someone's background and the work they actually do. You don't need to know certification terminology.

This is the same rules engine that powers the Techcanvass BA Certification Finder browser extension
and WordPress plugin, so it gives identical results everywhere.

```bash
pip install ba-certification-finder
```

Requires Python 3.10+. Works on Windows, macOS and Linux.

## Command line

```bash
ba-cert-finder
```

This opens a guided questionnaire: about you, your work activities, then your matches.

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
    "totalYears": 6,            # values: see `ba-cert-finder questions`
    "background": "ba",
    "education": "bachelor",
    "interest": "general",
    "activities": [0, 1, 4, 6], # indices of everyday work activities
    "baYears": 6,
    "baShare": 0.7,
    "continuity": "continuous",
    "recent": "current",
})
for m in report["matches"]:
    print(m["code"], "-", m["status"])

result = check_eligibility({
    "baHours": 5000, "pdHours": 35, "agreesToEthics": True,
    "kaHours": {"planning": 1200, "elicitation": 1200, "radd": 900, "strategy": 900},
})
print(result["recommended"])   # "CCBA"
```

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
