import { describe, expect, it } from "vitest";
import {
  AdvisorInputError,
  BUNDLED_RULES,
  advisorStepCount,
  buildAdvisorReport,
  goalsFor,
  isValidRuleSet,
  nextAdvisorStage,
  validateAdvisorAnswers,
  type AdvisorAnswers,
  type RuleSet,
} from "../src";

const run = (a: AdvisorAnswers) => buildAdvisorReport(a, BUNDLED_RULES);
const keys = (a: AdvisorAnswers) => run(a).courses.map((c) => c.key);

describe("question flow", () => {
  it("asks background only to people with no BA experience", () => {
    expect(nextAdvisorStage("experience", { experience: "none" })).toBe("background");
    expect(nextAdvisorStage("experience", { experience: "2to4" })).toBe("goal");
    expect(nextAdvisorStage("background", { experience: "none", background: "it" })).toBe("result");
  });

  it("asks a follow-up only for goals that have one", () => {
    const next = (goal: AdvisorAnswers["goal"]) => nextAdvisorStage("goal", { experience: "2to4", goal });
    expect(next("agile")).toBe("agile");
    expect(next("domain")).toBe("domain");
    expect(next("data")).toBe("analytics");
    expect(next("cyber")).toBe("cyber");
    expect(next("ai")).toBe("ai");
    expect(next("agents")).toBe("ai");
    for (const g of ["career", "technical", "unsure"] as const) expect(next(g)).toBe("result");
  });

  it("counts questions on each path", () => {
    expect(advisorStepCount({ experience: "none" })).toBe(2);
    expect(advisorStepCount({ experience: "2to4", goal: "career" })).toBe(2);
    expect(advisorStepCount({ experience: "2to4", goal: "agile" })).toBe(3);
  });

  it("hides data from 2–4 and 5+ years, and technical from 5+ years", () => {
    const values = (e: AdvisorAnswers["experience"]) => goalsFor(BUNDLED_RULES, e).map((g) => g.value);
    expect(values("lt2")).toContain("data");
    expect(values("2to4")).not.toContain("data");
    expect(values("2to4")).toContain("technical");
    expect(values("5plus")).not.toContain("data");
    expect(values("5plus")).not.toContain("technical");
  });
});

describe("recommendations", () => {
  it("recommends ECBA + domain for every no-experience profile", () => {
    for (const background of ["nonit", "it", "student"] as const) {
      const r = run({ experience: "none", background });
      expect(r.courses.map((c) => c.key)).toEqual(["ecba", "domain"]);
      expect(r.courses[0]!.role).toBe("primary");
      expect(r.courses[1]!.role).toBe("optional");
    }
  });

  it("tailors the intro to the background", () => {
    expect(run({ experience: "none", background: "it" }).intro).toMatch(/exposure to IT systems/);
    expect(run({ experience: "none", background: "student" }).intro).toMatch(/student or fresher/);
    expect(run({ experience: "none", background: "nonit" }).intro).toMatch(/industry experience/);
  });

  it("maps experience to the baseline certification", () => {
    expect(keys({ experience: "lt2", goal: "career" })[0]).toBe("ecba");
    expect(keys({ experience: "2to4", goal: "career" })[0]).toBe("ccba");
    expect(keys({ experience: "5plus", goal: "career" })[0]).toBe("cbap");
  });

  it("takes the CCBA/CBAP hour figures in the notice from the rules, not from code", () => {
    expect(run({ experience: "2to4", goal: "career" }).notice).toContain("3,750");
    expect(run({ experience: "5plus", goal: "career" }).notice).toContain("7,500");

    const changed: RuleSet = structuredClone(BUNDLED_RULES);
    changed.certifications.find((c) => c.code === "CCBA")!.workHours = 4000;
    expect(buildAdvisorReport({ experience: "2to4", goal: "career" }, changed).notice).toContain("4,000");
  });

  it("agile: AAC, CPOA or both, with issuer credentials as extras", () => {
    expect(keys({ experience: "2to4", goal: "agile", agile: "agile" })).toEqual(["aac", "ccba"]);
    expect(keys({ experience: "2to4", goal: "agile", agile: "product" })).toEqual(["cpoa", "cspo", "pspo", "ccba"]);
    expect(keys({ experience: "2to4", goal: "agile", agile: "both" })).toEqual(["aac", "cpoa", "cspo", "pspo", "ccba"]);
  });

  it("links CPOA to its IIBA page and CSPO/PSPO to their own issuers", () => {
    const r = run({ experience: "5plus", goal: "agile", agile: "product" });
    expect(r.courses.find((c) => c.key === "cpoa")!.issuerUrl).toContain("iiba.org");
    const cspo = r.courses.find((c) => c.key === "cspo")!;
    expect(cspo.external).toBe(true);
    expect(cspo.issuer).toBe("Scrum Alliance");
  });

  it("data: CBDA, hands-on analytics or both", () => {
    expect(keys({ experience: "lt2", goal: "data", analytics: "cert" })[0]).toBe("cbda");
    expect(keys({ experience: "lt2", goal: "data", analytics: "hands" })[0]).toBe("analytics");
    expect(keys({ experience: "lt2", goal: "data", analytics: "both" }).slice(0, 2)).toEqual(["analytics", "cbda"]);
  });

  it("ai and agents order the two AI courses by priority", () => {
    expect(keys({ experience: "2to4", goal: "ai", ai: "productivity" })[0]).toBe("aiba");
    expect(keys({ experience: "2to4", goal: "ai", ai: "agents" })[0]).toBe("agents");
    expect(keys({ experience: "2to4", goal: "ai", ai: "both" }).slice(0, 2)).toEqual(["aiba", "agents"]);
    expect(keys({ experience: "2to4", goal: "agents", ai: "productivity" }).slice(0, 2)).toEqual(["aiba", "agents"]);
    expect(keys({ experience: "2to4", goal: "agents", ai: "both" }).slice(0, 2)).toEqual(["agents", "aiba"]);
  });

  it("adds an agent-prototype step only when agents are in scope", () => {
    const has = (ai: "productivity" | "agents" | "both") =>
      run({ experience: "2to4", goal: "ai", ai }).roadmap.some((s) => /low-code AI agent/.test(s));
    expect(has("productivity")).toBe(false);
    expect(has("agents")).toBe(true);
    expect(has("both")).toBe(true);
  });

  it("domain mentions the chosen industry, unless unsure", () => {
    expect(run({ experience: "2to4", goal: "domain", domain: "insurance" }).intro).toContain("in insurance.");
    expect(run({ experience: "2to4", goal: "domain", domain: "unsure" }).intro).not.toMatch(/ in /);
  });

  it("cybersecurity never claims a Techcanvass security credential", () => {
    const r = run({ experience: "2to4", goal: "cyber", cyber: "transition" });
    expect(r.courses[0]!.key).toBe("technical");
    expect(r.notice).toMatch(/not a substitute for specialist cybersecurity/);
  });

  it("never lists the same course twice", () => {
    for (const goal of ["career", "agile", "ai", "agents", "unsure"] as const) {
      const a: AdvisorAnswers = { experience: "2to4", goal, agile: "both", ai: "both" };
      const k = keys(a);
      expect(new Set(k).size).toBe(k.length);
    }
  });

  it("gives two reasons and a rules version on every path", () => {
    const r = run({ experience: "2to4", goal: "unsure" });
    expect(r.why).toHaveLength(2);
    expect(r.rulesVersion).toBe(BUNDLED_RULES.version);
  });

  it("does not leak internal wording into the reason text", () => {
    for (const background of ["nonit", "it", "student"] as const) {
      expect(run({ experience: "none", background }).reason).not.toMatch(/uploaded|decision tree/i);
    }
  });
});

describe("validation", () => {
  it("requires experience", () => {
    expect(validateAdvisorAnswers({ experience: null }, BUNDLED_RULES)).toEqual([
      { field: "experience", message: "Please choose an answer." },
    ]);
  });

  it("requires a background for beginners and a goal for everyone else", () => {
    expect(validateAdvisorAnswers({ experience: "none" }, BUNDLED_RULES)[0]!.field).toBe("background");
    expect(validateAdvisorAnswers({ experience: "lt2" }, BUNDLED_RULES)[0]!.field).toBe("goal");
  });

  it("requires the follow-up that belongs to the chosen goal", () => {
    expect(validateAdvisorAnswers({ experience: "2to4", goal: "agile" }, BUNDLED_RULES)[0]!.field).toBe("agile");
    expect(validateAdvisorAnswers({ experience: "2to4", goal: "agents" }, BUNDLED_RULES)[0]!.field).toBe("ai");
  });

  it("rejects a goal that is not offered for that experience", () => {
    const errs = validateAdvisorAnswers({ experience: "5plus", goal: "data", analytics: "cert" }, BUNDLED_RULES);
    expect(errs[0]!.field).toBe("goal");
  });

  it("rejects unknown values and throws AdvisorInputError with per-field details", () => {
    expect(() => run({ experience: "10plus" as never })).toThrow(AdvisorInputError);
    try {
      run({ experience: "2to4", goal: "agile" });
    } catch (e) {
      expect((e as AdvisorInputError).errors[0]!.field).toBe("agile");
    }
  });
});

describe("hosted rules", () => {
  it("accepts the bundled rules", () => {
    expect(isValidRuleSet(BUNDLED_RULES)).toBe(true);
  });

  it("rejects a file from the old Finder (no advisor section)", () => {
    const old: Record<string, unknown> = { ...BUNDLED_RULES };
    delete old.advisor;
    old.finder = {};
    expect(isValidRuleSet(old)).toBe(false);
  });

  it("rejects an advisor section missing a course the logic can recommend", () => {
    const broken: RuleSet = structuredClone(BUNDLED_RULES);
    delete broken.advisor.courses.cpoa;
    expect(isValidRuleSet(broken)).toBe(false);
  });

  it("rejects a non-https course link", () => {
    const broken: RuleSet = structuredClone(BUNDLED_RULES);
    broken.advisor.courses.ecba!.url = "javascript:alert(1)";
    expect(isValidRuleSet(broken)).toBe(false);
  });

  it("rejects an option value the logic does not know", () => {
    const broken: RuleSet = structuredClone(BUNDLED_RULES);
    broken.advisor.questions.experience.options.push({ value: "10plus", label: "10+" });
    expect(isValidRuleSet(broken)).toBe(false);
  });

  it("rejects a file that drops an answer the logic needs", () => {
    const broken: RuleSet = structuredClone(BUNDLED_RULES);
    broken.advisor.questions.agile.options = broken.advisor.questions.agile.options.filter((o) => o.value !== "both");
    expect(isValidRuleSet(broken)).toBe(false);
  });
});
