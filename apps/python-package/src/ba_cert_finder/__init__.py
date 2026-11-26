"""BA Certification Advisor — find the right Business Analysis path.

Uses the same rules engine as the Techcanvass browser extension and WordPress plugin::

    from ba_cert_finder import find_certifications

    report = find_certifications({"experience": "2to4", "goal": "agile", "agile": "both"})
    print(report["title"])
    for course in report["courses"]:
        print(course["role"], "-", course["name"])
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


_ERRORS = {
    "AdvisorInputError": FinderInputError,
    "EligibilityInputError": EligibilityInputError,
}


def _run(fn: str, payload: Mapping[str, Any], rules: Mapping[str, Any] | None) -> dict:
    result = _engine.call(fn, dict(payload), dict(rules) if rules is not None else None)
    if "error" in result:
        err = result["error"]
        raise _ERRORS.get(err.get("name"), BACertFinderError)(err.get("message", "Invalid input"), err.get("errors"))
    return result["value"]


def find_certifications(answers: Mapping[str, Any], *, rules: Mapping[str, Any] | None = None) -> dict:
    """Guided advisor: recommend a certification path, roadmap and courses.

    ``answers`` keys: ``experience`` (always); ``background`` when experience is ``"none"``;
    otherwise ``goal`` plus the follow-up that goes with it (``agile`` for goal ``agile``,
    ``domain``, ``analytics`` for goal ``data``, ``cyber``, ``ai`` for goals ``ai`` and
    ``agents``). Allowed values are in ``bundled_rules()["advisor"]["questions"]`` and
    ``["goals"]``.

    Returns a report with ``title``, ``intro``, ``reason``, ``roadmap`` (list of steps),
    ``courses`` (each with ``key``, ``name``, ``url`` and ``role`` of ``primary``, ``also`` or
    ``optional``), ``why`` (two points) and ``notice``.
    """
    return _run("buildAdvisorReport", answers, rules)


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
