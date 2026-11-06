"""BA Certification Finder — find the right Business Analyst certification.

Uses the same rules engine as the Techcanvass browser extension and WordPress plugin::

    from ba_cert_finder import find_certifications

    report = find_certifications({
        "totalYears": 6, "background": "ba", "education": "bachelor", "interest": "general",
        "activities": [0, 1, 4, 6], "baYears": 6, "baShare": 0.7,
        "continuity": "continuous", "recent": "current",
    })
    for m in report["matches"]:
        print(m["code"], "-", m["status"])
"""

from __future__ import annotations

import copy
import json
import urllib.request
from collections.abc import Mapping
from importlib.metadata import PackageNotFoundError, version
from typing import Any

from . import _engine

try:
    __version__ = version("ba-certification-finder")
except PackageNotFoundError:  # running from a source checkout
    __version__ = "0.0.0"

__all__ = [
    "BACertFinderError",
    "EligibilityInputError",
    "FinderInputError",
    "bundled_rules",
    "check_eligibility",
    "find_certifications",
    "load_rules",
    "__version__",
]


class BACertFinderError(ValueError):
    """Invalid input. ``errors`` lists ``{"field": ..., "message": ...}`` per problem."""

    def __init__(self, message: str, errors: list[dict[str, str]] | None = None):
        super().__init__(message)
        self.errors = errors or []


class FinderInputError(BACertFinderError):
    """Raised by :func:`find_certifications` for invalid answers."""


class EligibilityInputError(BACertFinderError):
    """Raised by :func:`check_eligibility` for invalid input."""


_ERRORS = {"FinderInputError": FinderInputError, "EligibilityInputError": EligibilityInputError}


def _run(fn: str, payload: Mapping[str, Any], rules: Mapping[str, Any] | None) -> dict:
    result = _engine.call(fn, dict(payload), dict(rules) if rules is not None else None)
    if "error" in result:
        err = result["error"]
        raise _ERRORS.get(err.get("name"), BACertFinderError)(err.get("message", "Invalid input"), err.get("errors"))
    return result["value"]


def find_certifications(answers: Mapping[str, Any], *, rules: Mapping[str, Any] | None = None) -> dict:
    """Guided finder: suggest certifications from background and work activities.

    ``answers`` keys: totalYears, background, education, interest, activities (indices into
    ``bundled_rules()["finder"]["activities"]``), baYears, baShare, continuity, recent and
    optionally ``precise`` (exact CCBA/CBAP hours). Allowed values for each question are in
    ``bundled_rules()["finder"]["questions"]``.

    Returns a report with ``headline``, ``detail``, ``warnings`` and ``matches`` (one per
    certification, each with ``code``, ``status``, ``tone`` and ``notes``).
    """
    return _run("buildFinderReport", answers, rules)


def check_eligibility(candidate: Mapping[str, Any], *, rules: Mapping[str, Any] | None = None) -> dict:
    """Quick hours-based check for ECBA, CCBA and CBAP.

    ``candidate`` keys: agreesToEthics (required), baHours or jobs, pdHours or pdEntries,
    kaHours, references, asOf (YYYY-MM-DD).
    """
    return _run("checkEligibility", candidate, rules)


def bundled_rules() -> dict:
    """The rules, questions and certifications shipped with this version."""
    return copy.deepcopy(_bundled())


_BUNDLED: dict | None = None


def _bundled() -> dict:
    global _BUNDLED
    if _BUNDLED is None:
        _BUNDLED = json.loads(_engine.bundled_rules_text())
    return _BUNDLED


def load_rules(url: str | None = None, *, timeout: float = 4.0) -> tuple[dict, str]:
    """Fetch hosted rules, falling back to the bundled copy.

    Returns ``(rules, source)`` where source is ``"remote"`` or ``"bundled"``. The remote file
    is used only if the shared core accepts it and it is not older than the bundled copy, so a
    bad upload can't break anything.
    """
    if not url:
        return bundled_rules(), "bundled"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": f"ba-certification-finder/{__version__}"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (URL chosen by the caller)
            remote = json.loads(resp.read().decode("utf-8"))
    except Exception:  # network, HTTP or JSON error
        return bundled_rules(), "bundled"
    if not isinstance(remote, dict) or _engine.rules_status(remote) != "ok":
        return bundled_rules(), "bundled"
    return remote, "remote"
