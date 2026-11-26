import type { AdvisorConfig, CandidateInput, KnowledgeAreaId, RuleSet } from "./types";
import { parseISODate } from "./dates";

export const KNOWLEDGE_AREA_IDS: readonly KnowledgeAreaId[] = [
  "planning",
  "elicitation",
  "lifecycle",
  "strategy",
  "radd",
  "evaluation",
];

const PD_TYPES = [
  "course",
  "workshop",
  "webinar",
  "conference",
  "self-study",
  "reading",
  "work-experience",
];

export interface ValidationError {
  field: string;
  message: string;
}

const isNonNegNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

function checkDate(errors: ValidationError[], field: string, value: unknown): Date | null {
  if (typeof value !== "string") {
    errors.push({ field, message: "Date is required (YYYY-MM-DD)" });
    return null;
  }
  try {
    return parseISODate(value);
  } catch (e) {
    errors.push({ field, message: (e as Error).message });
    return null;
  }
}

/** Validate candidate input. Returns an empty array when valid. */
export function validateInput(input: CandidateInput): ValidationError[] {
  const errors: ValidationError[] = [];

  const asOf = input.asOf ? checkDate(errors, "asOf", input.asOf) : new Date();

  if (input.baHours !== undefined && !isNonNegNumber(input.baHours)) {
    errors.push({ field: "baHours", message: "BA hours must be a number ≥ 0" });
  }
  if (input.pdHours !== undefined && !isNonNegNumber(input.pdHours)) {
    errors.push({ field: "pdHours", message: "PD hours must be a number ≥ 0" });
  }
  if (input.references !== undefined && !isNonNegNumber(input.references)) {
    errors.push({ field: "references", message: "References must be a number ≥ 0" });
  }
  if (typeof input.agreesToEthics !== "boolean") {
    errors.push({ field: "agreesToEthics", message: "Ethics agreement must be true or false" });
  }

  input.jobs?.forEach((job, i) => {
    const f = `jobs[${i}]`;
    const start = checkDate(errors, `${f}.start`, job.start);
    const end = job.end ? checkDate(errors, `${f}.end`, job.end) : null;
    if (start && end && end < start) {
      errors.push({ field: `${f}.end`, message: "End date is before start date" });
    }
    if (start && asOf && start > asOf) {
      errors.push({ field: `${f}.start`, message: "Start date is in the future" });
    }
    if (!isNonNegNumber(job.hoursPerWeek) || job.hoursPerWeek > 80) {
      errors.push({ field: `${f}.hoursPerWeek`, message: "Hours per week must be 0–80" });
    }
    if (!isNonNegNumber(job.baPercent) || job.baPercent > 100) {
      errors.push({ field: `${f}.baPercent`, message: "BA percentage must be 0–100" });
    }
  });

  input.pdEntries?.forEach((pd, i) => {
    const f = `pdEntries[${i}]`;
    checkDate(errors, `${f}.completedOn`, pd.completedOn);
    if (!isNonNegNumber(pd.hours)) {
      errors.push({ field: `${f}.hours`, message: "PD hours must be a number ≥ 0" });
    }
    if (!PD_TYPES.includes(pd.type)) {
      errors.push({ field: `${f}.type`, message: `Unknown PD type "${pd.type}"` });
    }
  });

  if (input.kaHours) {
    for (const [ka, hours] of Object.entries(input.kaHours)) {
      if (!KNOWLEDGE_AREA_IDS.includes(ka as KnowledgeAreaId)) {
        errors.push({ field: `kaHours.${ka}`, message: `Unknown knowledge area "${ka}"` });
      } else if (!isNonNegNumber(hours)) {
        errors.push({ field: `kaHours.${ka}`, message: "Hours must be a number ≥ 0" });
      }
    }
  }

  return errors;
}

/**
 * Allowed option values per question. The advisor logic branches on these exact values,
 * so a hosted rules file may relabel or reorder options but not invent new ones.
 */
const ADVISOR_VALUES: Record<keyof AdvisorConfig["questions"], readonly string[]> = {
  experience: ["none", "lt2", "2to4", "5plus"],
  background: ["nonit", "it", "student"],
  agile: ["agile", "product", "both"],
  domain: ["banking", "insurance", "health", "supply", "telecom", "unsure"],
  analytics: ["cert", "hands", "both"],
  cyber: ["securityba", "transition"],
  ai: ["productivity", "agents", "both"],
};

const GOAL_VALUES = ["career", "agile", "data", "technical", "ai", "agents", "cyber", "domain", "unsure"];
const EXPERIENCE_VALUES = ADVISOR_VALUES.experience;

/** Course keys the advisor logic can recommend; a hosted file must define all of them. */
const REQUIRED_COURSES = [
  "ecba", "ccba", "cbap", "aac", "cpoa", "cbda", "analytics", "technical",
  "aiba", "agents", "domain", "cspo", "pspo", "catalog",
];

const isUrl = (v: unknown) => typeof v === "string" && /^https:\/\//.test(v);

function isValidAdvisor(f: unknown): f is AdvisorConfig {
  if (!f || typeof f !== "object") return false;
  const a = f as Partial<AdvisorConfig>;
  if (!a.questions || !Array.isArray(a.goals) || !a.courses || !Array.isArray(a.sourceLinks)) return false;

  const questionsOk = (Object.keys(ADVISOR_VALUES) as (keyof AdvisorConfig["questions"])[]).every((key) => {
    const q = a.questions![key];
    const allowed = ADVISOR_VALUES[key];
    return (
      q &&
      typeof q.title === "string" &&
      typeof q.helper === "string" &&
      Array.isArray(q.options) &&
      // Every allowed value needs an option, or some answers could never be chosen.
      allowed.every((v) => q.options.some((o) => o?.value === v)) &&
      q.options.every((o) => o && typeof o.label === "string" && allowed.includes(o.value))
    );
  });
  if (!questionsOk) return false;

  const goalsOk =
    a.goals.every(
      (g) =>
        g &&
        typeof g.label === "string" &&
        GOAL_VALUES.includes(g.value) &&
        (g.hideFor === undefined || (Array.isArray(g.hideFor) && g.hideFor.every((x) => EXPERIENCE_VALUES.includes(x)))),
    ) && GOAL_VALUES.every((v) => a.goals!.some((g) => g.value === v));
  if (!goalsOk) return false;

  const courses = a.courses as Record<string, unknown>;
  const coursesOk = REQUIRED_COURSES.every((key) => {
    const c = courses[key] as Record<string, unknown> | undefined;
    return (
      c &&
      typeof c.name === "string" &&
      typeof c.desc === "string" &&
      isUrl(c.url) &&
      (c.issuerUrl === undefined || isUrl(c.issuerUrl))
    );
  });
  return coursesOk && a.sourceLinks.every((l) => l && typeof l.label === "string" && isUrl(l.url));
}

/** Type guard used by the rules loader before trusting remote JSON. */
export function isValidRuleSet(value: unknown): value is RuleSet {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<RuleSet>;
  if (typeof r.version !== "string" || !Array.isArray(r.certifications)) return false;
  if (!Array.isArray(r.knowledgeAreas) || !Array.isArray(r.pdExcludedTypes)) return false;

  if (!isValidAdvisor(r.advisor)) return false;

  return r.certifications.every(
    (c) =>
      c &&
      ["ECBA", "CCBA", "CBAP"].includes(c.code) &&
      isNonNegNumber(c.workHours) &&
      isNonNegNumber(c.workWindowYears) &&
      isNonNegNumber(c.pdHours) &&
      isNonNegNumber(c.pdWindowYears) &&
      isNonNegNumber(c.references) &&
      (c.knowledgeAreas === null ||
        (Array.isArray(c.knowledgeAreas?.anyOf) &&
          c.knowledgeAreas.anyOf.every(
            (o) => isNonNegNumber(o.minHoursEach) && isNonNegNumber(o.count),
          ))),
  );
}
