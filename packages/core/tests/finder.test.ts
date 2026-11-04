import { describe, expect, it } from "vitest";
import {
  BUNDLED_RULES as rules,
  buildFinderReport,
  checkEligibility,
  FinderInputError,
  validateFinderStep1,
  validatePrecise,
  yearsInWindow,
  type FinderAnswers,
} from "../src";

const base: FinderAnswers = {
  totalYears: 6,
  background: "ba",
  education: "bachelor",
  interest: "unsure",
  activities: [],
  baYears: null,
  baShare: null,
  continuity: null,
  recent: null,
};

const ALL_ACTIVITIES = rules.finder.activities.map((_, i) => i);
const match = (a: FinderAnswers, code: string) => buildFinderReport(a, rules).matches.find((m) => m.code === code)!;

describe("step 1 validation", () => {
  it("requires experience and background", () => {
    const errs = validateFinderStep1({ totalYears: null, background: null });
    expect(errs.map((e) => e.field)).toEqual(["totalYears", "background"]);
  });
  it("accepts 0 years ('just starting') as an answer", () => {
    expect(validateFinderStep1({ totalYears: 0, background: "student" })).toEqual([]);
  });
});

describe("fresh starter", () => {
  const report = buildFinderReport({ ...base, totalYears: 0, background: "student" }, rules);

  it("suggests ECBA first with the no-activities headline", () => {
    expect(report.matches[0]!.code).toBe("ECBA");
    expect(report.matches[0]!.tone).toBe("good");
    expect(report.headline).toMatch(/consider ECBA now/);
  });
  it("lists all 7 certifications", () => {
    expect(report.matches.map((m) => m.code).sort()).toEqual(
      ["AAC", "CBAP", "CBDA", "CCA", "CCBA", "ECBA", "PMI-PBA"].sort(),
    );
  });
  it("marks CCBA/CBAP as may need more experience", () => {
    expect(report.matches.find((m) => m.code === "CCBA")!.status).toBe("May need more experience");
  });
});

describe("indicative estimate (no exact hours)", () => {
  const experienced: FinderAnswers = {
    ...base,
    totalYears: 12,
    activities: ALL_ACTIVITIES,
    baYears: 11,
    baShare: 0.9,
    recent: "current",
  };

  it("experienced, current BA → potential match for CCBA and CBAP", () => {
    expect(match(experienced, "CCBA").status).toBe("Potential match — verify hours");
    expect(match(experienced, "CBAP").status).toBe("Potential match — verify hours");
  });

  it("caps years at the window: 11 yrs at 25–50%, stopped 2–7 yrs ago → CCBA not indicated", () => {
    // Original prototype used all 11 years (11 × 1600 × 0.4 = 7,040 ≥ 3,750).
    // Only ≤5 of those years can fall in the 7-year window: 5 × 640 = 3,200 < 3,750.
    const r = match({ ...experienced, baShare: 0.4, recent: "2to7" }, "CCBA");
    expect(r.status).toBe("May need more experience");
  });

  it("last activity 7–10 years ago → CCBA not indicated, CBAP still possible window", () => {
    expect(yearsInWindow(11, "7to10", 7)).toBe(0);
    expect(yearsInWindow(11, "7to10", 10)).toBe(3);
  });

  it("more than 10 years ago → nothing counts", () => {
    expect(yearsInWindow(11, "over10", 10)).toBe(0);
    expect(match({ ...experienced, recent: "over10" }, "CBAP").tone).toBe("warn");
  });

  it("no activities selected → not plausible even with years", () => {
    expect(match({ ...experienced, activities: [] }, "CCBA").status).toBe("May need more experience");
  });

  it("adds PD + references as later requirements from the rules", () => {
    expect(match(experienced, "CCBA").notes.at(-1)).toBe(
      "Later: 21 professional-development hours in the last 4 years and 2 references.",
    );
    expect(match(experienced, "CBAP").notes.at(-1)).toMatch(/35 professional-development hours.*2 references/);
  });
});

describe("precise hours", () => {
  const full = (n: number) => Array(6).fill(n) as number[];

  it("total below threshold → hours gap with exact number", () => {
    const r = match({ ...base, precise: { CCBA: { total: 3000, ka: Array(6).fill(null) } } }, "CCBA");
    expect(r.status).toBe("Experience hours gap");
    expect(r.notes[0]).toBe("750 more qualifying hours needed within 7 years.");
  });

  it("total met but KA blank → verify knowledge-area hours", () => {
    const r = match({ ...base, precise: { CBAP: { total: 8000, ka: Array(6).fill(null) } } }, "CBAP");
    expect(r.status).toBe("Verify knowledge-area hours");
  });

  it("CBAP thresholds met → good", () => {
    const r = match(
      { ...base, precise: { CBAP: { total: 8000, ka: [1000, 1000, 1000, 1000, 0, 0] } } },
      "CBAP",
    );
    expect(r.status).toBe("Experience thresholds indicated");
    expect(r.tone).toBe("good");
  });

  it("CBAP with only 3 areas at 900+ → knowledge-area gap", () => {
    const r = match(
      { ...base, precise: { CBAP: { total: 8000, ka: [2000, 2000, 2000, 500, 0, 0] } } },
      "CBAP",
    );
    expect(r.status).toBe("Knowledge-area gap");
    expect(r.notes[0]).toMatch(/1 more knowledge area/);
  });

  it("CCBA alternative rule (500+ in 4 areas) passes", () => {
    const r = match({ ...base, precise: { CCBA: { total: 3750, ka: [600, 600, 600, 600, 0, 0] } } }, "CCBA");
    expect(r.tone).toBe("good");
  });

  it("rejects 7-year total above 10-year total", () => {
    const errs = validatePrecise(
      { CCBA: { total: 5000, ka: full(0) }, CBAP: { total: 4000, ka: full(0) } },
      rules,
    );
    expect(errs.some((e) => e.message === "7-year hours cannot exceed 10-year hours.")).toBe(true);
  });

  it("rejects an area's 7-year hours above its 10-year hours", () => {
    const errs = validatePrecise(
      {
        CCBA: { total: 4000, ka: [900, 0, 0, 0, 0, 0] },
        CBAP: { total: 8000, ka: [500, 0, 0, 0, 0, 0] },
      },
      rules,
    );
    expect(errs.map((e) => e.field)).toContain("CCBA.ka.0");
  });

  it("rejects area hours that add up to more than the total", () => {
    const errs = validatePrecise({ CCBA: { total: 1000, ka: [900, 900, null, null, null, null] } }, rules);
    expect(errs[0]!.message).toMatch(/cannot exceed the 7-year total/);
  });

  it("rejects negative hours and throws from buildFinderReport", () => {
    expect(() =>
      buildFinderReport({ ...base, precise: { CCBA: { total: -1, ka: full(0) } } }, rules),
    ).toThrow(FinderInputError);
  });
});

describe("PMI-PBA", () => {
  it.each([
    ["gac", "24 qualifying months"],
    ["bachelor", "36 qualifying months"],
    ["secondary", "60 qualifying months"],
    ["other", "confirm your education pathway"],
  ] as const)("education %s → %s", (education, text) => {
    expect(match({ ...base, education }, "PMI-PBA").notes[0]).toContain(text);
  });
});

describe("ordering & warnings", () => {
  it.each([
    ["agile", "AAC"],
    ["data", "CBDA"],
    ["cyber", "CCA"],
    ["project", "PMI-PBA"],
    ["general", "CCBA"],
  ] as const)("interest %s puts %s first", (interest, code) => {
    expect(buildFinderReport({ ...base, interest }, rules).matches[0]!.code).toBe(code);
  });

  it("warns when BA years exceed total years", () => {
    const r = buildFinderReport({ ...base, totalYears: 2, baYears: 6 }, rules);
    expect(r.warnings[0]).toMatch(/more years of these activities/);
  });

  it("warns when activities are selected but recency is 'never'", () => {
    const r = buildFinderReport({ ...base, activities: [0], recent: "never" }, rules);
    expect(r.warnings.some((w) => w.includes("haven't done these activities"))).toBe(true);
  });

  it("notes career breaks in the detail line", () => {
    expect(buildFinderReport({ ...base, continuity: "breaks" }, rules).detail).toMatch(/^Career breaks noted/);
  });
});

describe("references in the quick checker", () => {
  const ready = {
    asOf: "2026-10-31",
    baHours: 4000,
    pdHours: 21,
    kaHours: { planning: 900, radd: 900 },
    agreesToEthics: true,
  };
  it("are not gated when the caller doesn't ask (Discord, quick form)", () => {
    expect(checkEligibility(ready, rules).recommended).toBe("CCBA");
  });
  it("are gated when the caller passes a number", () => {
    const r = checkEligibility({ ...ready, references: 1 }, rules);
    const ccba = r.results.find((x) => x.code === "CCBA")!;
    expect(ccba.eligible).toBe(false);
    expect(ccba.requirements.find((q) => q.id === "references")!.gap).toBe("1 more reference(s) needed");
  });
});
