import type {
  CertificationRule,
  FinderAnswers,
  FinderCertDef,
  FinderMatch,
  FinderReport,
  KnowledgeAreaHours,
  PreciseHours,
  Recency,
  RuleSet,
} from "./types";
import { checkKnowledgeAreas } from "./eligibility";

const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

/**
 * Most optimistic "years since last BA activity" for each answer. Using the lower bound
 * means the indicative check never discourages someone who might qualify.
 */
const YEARS_SINCE_LAST: Record<Exclude<Recency, "never">, number> = {
  current: 0,
  lt2: 0,
  "2to7": 2,
  "7to10": 7,
  over10: 10,
};

export interface FinderError {
  field: string;
  message: string;
}

export class FinderInputError extends Error {
  constructor(public readonly errors: FinderError[]) {
    super(errors.map((e) => e.message).join("; "));
    this.name = "FinderInputError";
  }
}

/** Step 1 must have experience and background before moving on. */
export function validateFinderStep1(a: Pick<FinderAnswers, "totalYears" | "background">): FinderError[] {
  const errors: FinderError[] = [];
  if (a.totalYears === null) errors.push({ field: "totalYears", message: "Please select your experience." });
  if (a.background === null) errors.push({ field: "background", message: "Please select your background." });
  return errors;
}

const validNum = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);

/** Validate the optional precise-hours section. Field names: `<CODE>.total`, `<CODE>.ka.<i>`. */
export function validatePrecise(
  precise: FinderAnswers["precise"],
  rules: RuleSet,
): FinderError[] {
  const errors: FinderError[] = [];
  if (!precise) return errors;

  const hourCerts = rules.certifications
    .filter((c) => c.workHours > 0)
    .sort((a, b) => a.workWindowYears - b.workWindowYears);

  for (const cert of hourCerts) {
    const p = precise[cert.code];
    if (!p) continue;
    if (!validNum(p.total)) {
      errors.push({ field: `${cert.code}.total`, message: "Please enter valid non-negative hours." });
    }
    p.ka.forEach((v, i) => {
      if (!validNum(v)) errors.push({ field: `${cert.code}.ka.${i}`, message: "Please enter valid non-negative hours." });
    });
    const kaSum = p.ka.reduce<number>((s, v) => s + (v ?? 0), 0);
    if (p.total !== null && validNum(p.total) && p.ka.some((v) => v !== null) && kaSum > p.total) {
      errors.push({
        field: `${cert.code}.ka`,
        message: `Activity-area hours (${fmt(kaSum)}) cannot exceed the ${cert.workWindowYears}-year total (${fmt(p.total)}).`,
      });
    }
  }

  // A shorter window sits inside a longer one, so its hours can't be larger.
  for (let i = 0; i < hourCerts.length; i++) {
    for (let j = i + 1; j < hourCerts.length; j++) {
      const short = hourCerts[i]!;
      const long = hourCerts[j]!;
      const ps = precise[short.code];
      const pl = precise[long.code];
      if (!ps || !pl || short.workWindowYears >= long.workWindowYears) continue;
      if (ps.total !== null && pl.total !== null && ps.total > pl.total) {
        errors.push({
          field: `${short.code}.total`,
          message: `${short.workWindowYears}-year hours cannot exceed ${long.workWindowYears}-year hours.`,
        });
      }
      ps.ka.forEach((v, k) => {
        const lv = pl.ka[k];
        if (v !== null && lv !== null && lv !== undefined && v > lv) {
          errors.push({
            field: `${short.code}.ka.${k}`,
            message: `${short.workWindowYears}-year hours for an area cannot exceed its ${long.workWindowYears}-year hours.`,
          });
        }
      });
    }
  }
  return errors;
}

/** Years of BA activity that can fall inside a window ending today. */
export function yearsInWindow(baYears: number, recent: Recency | null, windowYears: number): number {
  if (recent === null || recent === "never") return 0;
  return Math.max(0, Math.min(baYears, windowYears - YEARS_SINCE_LAST[recent]));
}

function kaRecord(rules: RuleSet, ka: Array<number | null>): KnowledgeAreaHours {
  const rec: KnowledgeAreaHours = {};
  rules.knowledgeAreas.forEach((area, i) => {
    const v = ka[i];
    if (v !== null && v !== undefined) rec[area.id] = v;
  });
  return rec;
}

function hoursMatch(
  def: FinderCertDef,
  rule: CertificationRule,
  a: FinderAnswers,
  rules: RuleSet,
  areasCovered: number,
): Pick<FinderMatch, "status" | "tone" | "notes"> {
  const notes: string[] = [];
  let status = "Potential match — verify hours";
  let tone: FinderMatch["tone"] = "neutral";
  const need = rule.workHours;
  const period = rule.workWindowYears;
  const p: PreciseHours | undefined = a.precise?.[rule.code];

  if (p && p.total !== null) {
    if (p.total < need) {
      status = "Experience hours gap";
      tone = "warn";
      notes.push(`${fmt(need - p.total)} more qualifying hours needed within ${period} years.`);
    } else {
      const complete = p.ka.length === rules.knowledgeAreas.length && p.ka.every((v) => v !== null);
      const kaCheck = rule.knowledgeAreas
        ? checkKnowledgeAreas(rule.knowledgeAreas, kaRecord(rules, p.ka))
        : null;
      if (complete && (!kaCheck || kaCheck.met)) {
        status = "Experience thresholds indicated";
        tone = "good";
        notes.push(
          "Work-hour and knowledge-area thresholds appear met; training, references and application evidence still need checking.",
        );
      } else if (complete) {
        status = "Knowledge-area gap";
        tone = "warn";
        notes.push(`Your entered distribution does not meet the requirement: ${kaCheck!.gap}.`);
      } else {
        status = "Verify knowledge-area hours";
        notes.push(
          "You appear to meet the total-hour threshold. Enter hours for all 6 work areas (use 0 for areas you haven't worked in) to verify the distribution.",
        );
      }
    }
  } else {
    const years = yearsInWindow(a.baYears ?? 0, a.recent, period);
    const estimate = years * rules.finder.annualHoursEstimate * (a.baShare ?? 0);
    const plausible = years > 0 && areasCovered > 0;
    if (!plausible || estimate < need) {
      status = "May need more experience";
      tone = "warn";
      notes.push(
        `Your broad answers do not yet indicate ${fmt(need)} hours within the last ${period} years. This is not a formal rejection.`,
      );
    } else {
      notes.push("Your estimated experience may be sufficient; documented hours and work-area distribution need verification.");
    }
  }

  const later = [`${rule.pdHours} professional-development hours in the last ${rule.pdWindowYears} years`];
  if (rule.references > 0) later.push(`${rule.references} references`);
  notes.push(`Later: ${later.join(" and ")}.`);

  return { status, tone, notes };
}

function buildMatch(def: FinderCertDef, a: FinderAnswers, rules: RuleSet, areasCovered: number): FinderMatch {
  const base = { code: def.code, name: def.name, description: def.description, url: def.url };

  switch (def.kind) {
    case "open":
      return {
        ...base,
        status: "No experience prerequisite",
        tone: "good",
        notes: ["No minimum BA experience or mandatory training-hour requirement."],
      };
    case "knowledge":
      return { ...base, status: "Knowledge-based", tone: "good", notes: [] };
    case "months": {
      const months = def.monthsByEducation?.[a.education];
      return {
        ...base,
        status: "Experience verification needed",
        tone: "neutral",
        notes: [
          `Education-based experience requirement: ${
            months === undefined ? "confirm your education pathway" : `${months} qualifying months`
          } in the last ${def.windowYears ?? 8} years. Work periods must not overlap.`,
          `After selecting this certification: ${def.contactHours ?? 35} qualifying contact hours of BA education.`,
        ],
      };
    }
    case "hours": {
      const rule = rules.certifications.find((c) => c.code === def.code);
      if (!rule) throw new Error(`No hour rule for ${def.code}`);
      return { ...base, ...hoursMatch(def, rule, a, rules, areasCovered) };
    }
  }
}

/** Main entry for the guided finder. Throws FinderInputError on invalid answers. */
export function buildFinderReport(a: FinderAnswers, rules: RuleSet): FinderReport {
  const errors = [...validateFinderStep1(a), ...validatePrecise(a.precise, rules)];
  if (errors.length) throw new FinderInputError(errors);

  const { finder } = rules;
  const selected = a.activities.filter((i) => i >= 0 && i < finder.activities.length);
  const areas = new Set(selected.map((i) => finder.activities[i]!.ka));

  const priority = finder.interestPriority[a.interest] ?? finder.interestPriority.unsure;
  const rank = (code: string) => {
    const i = priority.indexOf(code);
    return i < 0 ? 20 : i;
  };
  const matches = [...finder.certifications]
    .sort((x, y) => rank(x.code) - rank(y.code))
    .map((def) => buildMatch(def, a, rules, areas.size));

  const headline =
    areas.size === 0
      ? "You can consider ECBA now. Select any activities you have performed to get better suggestions."
      : `You selected ${selected.length} everyday work ${selected.length === 1 ? "activity" : "activities"} spanning ${areas.size} of 6 analysis areas. These activities can be relevant even without a Business Analyst job title.`;

  const prefix =
    a.continuity === "breaks"
      ? "Career breaks noted. "
      : a.continuity === "parttime"
        ? "Variable working hours noted. "
        : "";
  const detail = `${prefix}Approximate time in role cannot be equated with qualifying BA hours. Experience from older periods is not automatically counted.`;

  const warnings: string[] = [];
  if (a.baYears !== null && a.totalYears !== null && a.baYears > a.totalYears) {
    warnings.push("You entered more years of these activities than your total work experience. Please check both answers.");
  }
  if (a.recent === "never" && (selected.length > 0 || (a.baYears ?? 0) > 0)) {
    warnings.push("You said you haven't done these activities, but selected some. Update “When did you last do these activities?” for better matches.");
  }

  return { headline, detail, warnings, matches, rulesVersion: rules.version };
}
