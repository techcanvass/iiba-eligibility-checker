import { describe, expect, it } from "vitest";
import { BUNDLED_RULES, compareVersions, isValidRuleSet, loadRules } from "../src";

const mockFetch = (body: unknown, ok = true, status = 200) =>
  (async () => ({ ok, status, json: async () => body })) as unknown as typeof fetch;

describe("rules file", () => {
  it("bundled rules pass schema validation", () => {
    expect(isValidRuleSet(BUNDLED_RULES)).toBe(true);
  });

  it("contains ECBA, CCBA and CBAP with expected thresholds", () => {
    const byCode = Object.fromEntries(BUNDLED_RULES.certifications.map((c) => [c.code, c]));
    expect(byCode.CCBA!.workHours).toBe(3750);
    expect(byCode.CCBA!.workWindowYears).toBe(7);
    expect(byCode.CBAP!.workHours).toBe(7500);
    expect(byCode.CBAP!.workWindowYears).toBe(10);
    expect(byCode.CBAP!.pdHours).toBe(35);
  });
});

describe("compareVersions", () => {
  it("compares numerically, not as strings", () => {
    expect(compareVersions("2026.10.1", "2026.9.5")).toBe(1);
    expect(compareVersions("2026.9.5", "2026.10.1")).toBe(-1);
    expect(compareVersions("2026.10.1", "2026.10.1")).toBe(0);
  });
});

describe("loadRules", () => {
  it("uses bundled rules when no URL is given", async () => {
    const r = await loadRules();
    expect(r.source).toBe("bundled");
  });

  it("uses remote rules when valid and newer", async () => {
    const remote = { ...BUNDLED_RULES, version: "2027.1.0" };
    const r = await loadRules({ url: "https://x/rules.json", fetchImpl: mockFetch(remote) });
    expect(r.source).toBe("remote");
    expect(r.rules.version).toBe("2027.1.0");
  });

  it("falls back on HTTP error", async () => {
    const r = await loadRules({ url: "https://x", fetchImpl: mockFetch({}, false, 500) });
    expect(r.source).toBe("bundled");
    expect(r.error).toBe("HTTP 500");
  });

  it("falls back on invalid schema", async () => {
    const r = await loadRules({ url: "https://x", fetchImpl: mockFetch({ version: "9999" }) });
    expect(r.source).toBe("bundled");
    expect(r.error).toMatch(/schema/);
  });

  it("falls back when remote is older than bundled", async () => {
    const old = { ...BUNDLED_RULES, version: "2020.1.0" };
    const r = await loadRules({ url: "https://x", fetchImpl: mockFetch(old) });
    expect(r.source).toBe("bundled");
  });

  it("falls back on network failure", async () => {
    const failing = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const r = await loadRules({ url: "https://x", fetchImpl: failing });
    expect(r.source).toBe("bundled");
    expect(r.error).toBe("offline");
  });
});
