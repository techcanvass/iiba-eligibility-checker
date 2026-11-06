"""Runs the shared JavaScript core (packages/core) inside V8 via mini-racer.

This package contains no certification logic of its own. ``_assets/ba-core.js`` is the exact
file the browser extension, WordPress plugin and Google Workspace add-on run, so a change in
``packages/core`` changes every platform at once.
"""

from __future__ import annotations

import atexit
import json
import threading
from importlib import resources
from typing import Any

from py_mini_racer import MiniRacer

# Small JS bridge: everything crosses the boundary as JSON text, so Python always gets
# plain dicts/lists and errors keep their name, message and per-field details.
_BRIDGE = r"""
globalThis.__bacf_call = function (fn, inputJson, rulesJson) {
  var rules = rulesJson ? JSON.parse(rulesJson) : BACore.BUNDLED_RULES;
  try {
    return JSON.stringify({ value: BACore[fn](JSON.parse(inputJson), rules) });
  } catch (e) {
    return JSON.stringify({ error: { name: e.name, message: e.message, errors: e.errors || null } });
  }
};
globalThis.__bacf_rules_status = function (rulesJson) {
  var r = JSON.parse(rulesJson);
  if (!BACore.isValidRuleSet(r)) return "invalid";
  return BACore.compareVersions(r.version, BACore.BUNDLED_RULES.version) < 0 ? "older" : "ok";
};
"""

_lock = threading.Lock()
_ctx: MiniRacer | None = None


def _asset(name: str) -> str:
    return resources.files("ba_cert_finder").joinpath("_assets", name).read_text(encoding="utf-8")


def _context() -> MiniRacer:
    global _ctx
    if _ctx is None:
        ctx = MiniRacer()
        ctx.eval(_asset("ba-core.js"))
        ctx.eval(_BRIDGE)
        # A V8 context left open blocks interpreter shutdown, so always close it at exit.
        atexit.register(ctx.close)
        _ctx = ctx
    return _ctx


def call(fn: str, payload: Any, rules: dict | None = None) -> dict:
    """Call a function exported by the core. Returns {"value": ...} or {"error": {...}}."""
    script = "__bacf_call({}, {}, {})".format(
        json.dumps(fn),
        json.dumps(json.dumps(payload)),
        json.dumps(json.dumps(rules) if rules is not None else ""),
    )
    with _lock:
        return json.loads(_context().eval(script))


def rules_status(rules: dict) -> str:
    """'ok', 'older' (than the bundled copy) or 'invalid' — checked by the shared core."""
    with _lock:
        return _context().eval("__bacf_rules_status({})".format(json.dumps(json.dumps(rules))))


def bundled_rules_text() -> str:
    return _asset("iiba-rules.json")
