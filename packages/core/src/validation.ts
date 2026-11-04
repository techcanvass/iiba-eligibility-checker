import type { CandidateInput, KnowledgeAreaId, RuleSet } from "./types";
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

/** Type guard used by the rules loader before trusting remote JSON. */
export function isValidRuleSet(value: unknown): value is RuleSet {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<RuleSet>;
  if (typeof r.version !== "string" || !Array.isArray(r.certifications)) return false;
  if (!Array.isArray(r.knowledgeAreas) || !Array.isArray(r.pdExcludedTypes)) return false;

  const f = r.finder;
  if (
    !f ||
    !isNonNegNumber(f.annualHoursEstimate) ||
    !Array.isArray(f.activities) ||
    !Array.isArray(f.certifications) ||
    !f.interestPriority ||
    !f.kaPlainNames ||
    !f.activities.every((a) => a && typeof a.label === "string" && KNOWLEDGE_AREA_IDS.includes(a.ka)) ||
    !f.certifications.every(
      (c) =>
        c &&
        typeof c.code === "string" &&
        typeof c.url === "string" &&
        ["open", "hours", "knowledge", "months"].includes(c.kind) &&
        // Every hours-based finder cert needs a matching hour rule.
        (c.kind !== "hours" || r.certifications!.some((rc) => rc?.code === c.code)),
    )
  ) {
    return false;
  }

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
