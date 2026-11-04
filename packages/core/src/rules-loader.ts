import type { RuleSet } from "./types";
import { isValidRuleSet } from "./validation";
import bundledRules from "../rules/iiba-rules.json";

export const BUNDLED_RULES = bundledRules as RuleSet;

/** Compare dotted numeric versions ("2026.10.1" > "2026.9.3"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

export interface LoadRulesOptions {
  /** Hosted rules JSON URL. When omitted, bundled rules are used. */
  url?: string;
  timeoutMs?: number;
  /** Injected for tests / non-browser runtimes. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface LoadedRules {
  rules: RuleSet;
  source: "remote" | "bundled";
  error?: string;
}

/**
 * Fetch hosted rules so an IIBA rule change needs no store resubmission.
 * Falls back to the bundled copy on any network, timeout or schema error,
 * and also when the remote copy is older than the bundled one.
 */
export async function loadRules(opts: LoadRulesOptions = {}): Promise<LoadedRules> {
  if (!opts.url) return { rules: BUNDLED_RULES, source: "bundled" };

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 4000);

  try {
    const res = await fetchImpl(opts.url, { signal: controller.signal, cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (!isValidRuleSet(json)) throw new Error("Remote rules failed schema validation");
    if (compareVersions(json.version, BUNDLED_RULES.version) < 0) {
      return { rules: BUNDLED_RULES, source: "bundled", error: "Remote rules are older than bundled" };
    }
    return { rules: json, source: "remote" };
  } catch (e) {
    return { rules: BUNDLED_RULES, source: "bundled", error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}
