import { describe, expect, it } from "vitest";
import {
  BUNDLED_RULES as rules,
  checkEligibility,
  EligibilityInputError,
  type CandidateInput,
  type CertCode,
} from "../src";

const AS_OF = "2026-10-30";

const base: CandidateInput = { asOf: AS_OF, agreesToEthics: true };

const result = (input: CandidateInput, code: CertCode) =>
  checkEligibility(input, rules).results.find((r) => r.code === code)!;

describe("ECBA", () => {
  it("is eligible with no experience when ethics agreed", () => {
    const r = result(base, "ECBA");
    expect(r.eligible).toBe(true);
  });

  it("is not eligible without the ethics agreement", () => {
    const r = result({ ...base, agreesToEthics: false }, "ECBA");
    expect(r.eligible).toBe(false);
    expect(r.requirements.find((q) => q.id === "ethics")!.met).toBe(false);
  });
});

describe("CCBA", () => {
  const ccbaReady: CandidateInput = {
    ...base,
    baHours: 3750,
    pdHours: 21,
    kaHours: { elicitation: 900, radd: 900 },
  };

  it("is eligible at exactly 3,750 BA hours / 21 PD / 900 in 2 KAs", () => {
    expect(result(ccbaReady, "CCBA").eligible).toBe(true);
  });

  it("is NOT eligible at 3,749 hours and reports a 1-hour gap", () => {
    const r = result({ ...ccbaReady, baHours: 3749 }, "CCBA");
    expect(r.eligible).toBe(false);
    expect(r.requirements[0]!.gap).toBe("1 more BA work hours needed");
  });

  it("is NOT eligible at 20 PD hours", () => {
    expect(result({ ...ccbaReady, pdHours: 20 }, "CCBA").eligible).toBe(false);
  });

  it("accepts the alternative KA rule: 500+ hours in 4 KAs", () => {
    const r = result(
      { ...ccbaReady, kaHours: { planning: 500, elicitation: 500, lifecycle: 500, radd: 500 } },
      "CCBA",
    );
    expect(r.eligible).toBe(true);
  });

  it("fails KA rule with 900 in only 1 KA and 500 in 3", () => {
    const r = result(
      { ...ccbaReady, kaHours: { planning: 900, elicitation: 500, lifecycle: 500 } },
      "CCBA",
    );
    const ka = r.requirements.find((q) => q.id === "knowledgeAreas")!;
    expect(ka.met).toBe(false);
    expect(ka.gap).toMatch(/1 more knowledge area/);
  });
});

describe("CBAP", () => {
  const cbapReady: CandidateInput = {
    ...base,
    baHours: 7500,
    pdHours: 35,
    kaHours: { planning: 900, elicitation: 900, radd: 900, strategy: 900 },
  };

  it("is eligible at exactly 7,500 / 35 PD / 900 in 4 KAs and is recommended", () => {
    const report = checkEligibility(cbapReady, rules);
    expect(report.results.every((r) => r.eligible)).toBe(true);
    expect(report.recommended).toBe("CBAP");
  });

  it("is NOT eligible with only 3 KAs at 900+, but CCBA still is", () => {
    const input = { ...cbapReady, kaHours: { planning: 900, elicitation: 900, radd: 900 } };
    const report = checkEligibility(input, rules);
    expect(report.results.find((r) => r.code === "CBAP")!.eligible).toBe(false);
    expect(report.recommended).toBe("CCBA");
  });

  it("CCBA-level candidate gets CCBA recommended and a CBAP hours gap", () => {
    const input = {
      ...base,
      baHours: 5000,
      pdHours: 35,
      kaHours: { planning: 1200, elicitation: 1200, radd: 900, strategy: 900 },
    };
    const report = checkEligibility(input, rules);
    expect(report.recommended).toBe("CCBA");
    expect(report.results.find((r) => r.code === "CBAP")!.requirements[0]!.gap).toBe(
      "2,500 more BA work hours needed",
    );
  });
});

describe("job history → BA hours", () => {
  it("ignores a job entirely outside the 10-year window", () => {
    const r = result(
      { ...base, jobs: [{ start: "2010-01-01", end: "2015-12-31", hoursPerWeek: 40, baPercent: 100 }] },
      "CBAP",
    );
    expect(r.requirements[0]!.actual).toBe(0);
  });

  it("counts only the part of a job inside the 7-year window", () => {
    // Window for 2026-10-30 starts 2019-10-31 → 62 days of this job count.
    const r = result(
      { ...base, jobs: [{ start: "2019-01-01", end: "2019-12-31", hoursPerWeek: 40, baPercent: 100 }] },
      "CCBA",
    );
    expect(r.requirements[0]!.actual).toBe(Math.floor((62 / 7) * 40)); // 354
  });

  it("applies the BA percentage", () => {
    const job = { start: "2024-10-31", end: "2025-10-30", hoursPerWeek: 40 };
    const full = result({ ...base, jobs: [{ ...job, baPercent: 100 }] }, "CCBA");
    const half = result({ ...base, jobs: [{ ...job, baPercent: 50 }] }, "CCBA");
    expect(half.requirements[0]!.actual).toBe(Math.floor(full.requirements[0]!.actual / 2));
  });

  it("projects a future eligibility date for an ongoing full-time BA role", () => {
    // ~1 year at 40h/week ≈ 2,086h → needs ~1,664h more ≈ 42 weeks.
    const r = result(
      {
        ...base,
        pdHours: 21,
        kaHours: { planning: 900, radd: 900 },
        jobs: [{ start: "2025-10-31", hoursPerWeek: 40, baPercent: 100 }],
      },
      "CCBA",
    );
    expect(r.eligible).toBe(false);
    expect(r.projectedEligibleOn).toBeDefined();
    expect(r.projectedEligibleOn! > "2027-08-01").toBe(true);
    expect(r.projectedEligibleOn! < "2027-09-15").toBe(true);
  });

  it("gives no projection when the candidate has no current BA work", () => {
    const r = result(
      { ...base, jobs: [{ start: "2022-01-01", end: "2023-01-01", hoursPerWeek: 40, baPercent: 100 }] },
      "CCBA",
    );
    expect(r.projectedEligibleOn).toBeUndefined();
  });
});

describe("PD hours", () => {
  it("excludes PD older than 4 years and self-study, with a warning", () => {
    const report = checkEligibility(
      {
        ...base,
        pdEntries: [
          { hours: 21, completedOn: "2026-03-01", type: "course" },
          { hours: 10, completedOn: "2022-10-30", type: "course" }, // day before window
          { hours: 8, completedOn: "2026-01-01", type: "self-study" },
        ],
      },
      rules,
    );
    const ccba = report.results.find((r) => r.code === "CCBA")!;
    expect(ccba.requirements[1]!.actual).toBe(21);
    expect(report.warnings.some((w) => w.includes("self-study"))).toBe(true);
  });

  it("counts PD completed on the first day of the window", () => {
    const r = result(
      { ...base, pdEntries: [{ hours: 35, completedOn: "2022-10-31", type: "workshop" }] },
      "CBAP",
    );
    expect(r.requirements[1]!.actual).toBe(35);
  });
});

describe("warnings & validation", () => {
  it("warns when KA hours exceed total BA hours", () => {
    const report = checkEligibility(
      { ...base, baHours: 1000, kaHours: { planning: 900, radd: 900 } },
      rules,
    );
    expect(report.warnings.some((w) => w.includes("exceed total BA hours"))).toBe(true);
  });

  it("throws EligibilityInputError on bad input", () => {
    expect(() =>
      checkEligibility(
        { ...base, jobs: [{ start: "2024-05-01", end: "2023-01-01", hoursPerWeek: 40, baPercent: 150 }] },
        rules,
      ),
    ).toThrow(EligibilityInputError);
  });

  it("rejects an impossible calendar date", () => {
    expect(() => checkEligibility({ ...base, asOf: "2026-02-30" }, rules)).toThrow(
      /Invalid calendar date/,
    );
  });

  it("rejects negative BA hours", () => {
    expect(() => checkEligibility({ ...base, baHours: -5 }, rules)).toThrow(EligibilityInputError);
  });
});
