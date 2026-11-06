import type {
  CandidateInput,
  CertificationRule,
  CertResult,
  EligibilityReport,
  KnowledgeAreaHours,
  KnowledgeAreaRule,
  RequirementResult,
  RuleSet,
} from "./types";
import { formatNumber } from "./format";
import { parseISODate, toISODate, todayISO } from "./dates";
import { baHoursInWindow, countablePdHours, projectEligibilityDate } from "./calculator";
import { validateInput } from "./validation";

const fmt = formatNumber;

export class EligibilityInputError extends Error {
  constructor(public readonly errors: { field: string; message: string }[]) {
    super(`Invalid input: ${errors.map((e) => `${e.field}: ${e.message}`).join("; ")}`);
    this.name = "EligibilityInputError";
  }
}

function checkWork(rule: CertificationRule, baHours: number): RequirementResult {
  const met = baHours >= rule.workHours;
  return {
    id: "work",
    label:
      rule.workHours === 0
        ? "Business analysis work experience"
        : `${fmt(rule.workHours)} BA hours in the last ${rule.workWindowYears} years`,
    met,
    required: rule.workHours,
    actual: baHours,
    gap: met ? "" : `${fmt(rule.workHours - baHours)} more BA work hours needed`,
  };
}

function checkPd(rule: CertificationRule, pdHours: number): RequirementResult {
  const met = pdHours >= rule.pdHours;
  return {
    id: "pd",
    label:
      rule.pdHours === 0
        ? "Professional development hours"
        : `${rule.pdHours} PD hours in the last ${rule.pdWindowYears} years`,
    met,
    required: rule.pdHours,
    actual: pdHours,
    gap: met ? "" : `${fmt(rule.pdHours - pdHours)} more PD hours needed`,
  };
}

/**
 * Knowledge-area check. Passes if ANY option is satisfied.
 * For the gap message we pick the option the candidate is closest to.
 */
export function checkKnowledgeAreas(
  rule: KnowledgeAreaRule,
  kaHours: KnowledgeAreaHours,
): RequirementResult {
  const hours = Object.values(kaHours).filter((h): h is number => typeof h === "number");

  const evaluated = rule.anyOf.map((opt) => {
    const qualifying = hours.filter((h) => h >= opt.minHoursEach).length;
    return { opt, qualifying, short: Math.max(0, opt.count - qualifying) };
  });

  const passing = evaluated.find((e) => e.short === 0);
  const closest = passing ?? [...evaluated].sort((a, b) => a.short - b.short)[0]!;

  const label = rule.anyOf
    .map((o) => `${fmt(o.minHoursEach)}+ hrs in ${o.count} of 6 knowledge areas`)
    .join(" OR ");

  return {
    id: "knowledgeAreas",
    label,
    met: Boolean(passing),
    required: closest.opt.count,
    actual: closest.qualifying,
    gap: passing
      ? ""
      : `${closest.short} more knowledge area(s) with ${fmt(closest.opt.minHoursEach)}+ hours needed`,
  };
}

function checkCert(
  rule: CertificationRule,
  input: CandidateInput,
  rules: RuleSet,
  asOf: Date,
): CertResult {
  const baHours =
    rule.workHours === 0
      ? 0
      : input.jobs?.length
        ? baHoursInWindow(input.jobs, asOf, rule.workWindowYears)
        : (input.baHours ?? 0);

  const pdHours = input.pdEntries?.length
    ? countablePdHours(input.pdEntries, asOf, rule.pdWindowYears, rules.pdExcludedTypes)
    : (input.pdHours ?? 0);

  const requirements: RequirementResult[] = [checkWork(rule, baHours), checkPd(rule, pdHours)];

  if (rule.knowledgeAreas) {
    requirements.push(checkKnowledgeAreas(rule.knowledgeAreas, input.kaHours ?? {}));
  }

  if (rule.references > 0 && input.references !== undefined) {
    const refs = input.references;
    requirements.push({
      id: "references",
      label: `${rule.references} professional references`,
      met: refs >= rule.references,
      required: rule.references,
      actual: refs,
      gap: refs >= rule.references ? "" : `${rule.references - refs} more reference(s) needed`,
    });
  }

  if (rule.requiresEthicsAgreement) {
    requirements.push({
      id: "ethics",
      label: "Agree to IIBA Code of Ethical Conduct",
      met: input.agreesToEthics,
      required: 1,
      actual: input.agreesToEthics ? 1 : 0,
      gap: input.agreesToEthics ? "" : "You must agree to the IIBA Code of Ethical Conduct",
    });
  }

  const result: CertResult = {
    code: rule.code,
    name: rule.name,
    eligible: requirements.every((r) => r.met),
    requirements,
    courseUrl: rule.courseUrl,
  };

  const workReq = requirements[0]!;
  if (!workReq.met && input.jobs?.length) {
    const projected = projectEligibilityDate(
      input.jobs,
      asOf,
      rule.workWindowYears,
      rule.workHours,
    );
    if (projected) result.projectedEligibleOn = toISODate(projected);
  }

  return result;
}

function buildWarnings(input: CandidateInput, rules: RuleSet, asOf: Date): string[] {
  const warnings: string[] = [];

  const kaTotal = Object.values(input.kaHours ?? {}).reduce((s, h) => s + (h ?? 0), 0);
  const maxWindow = Math.max(...rules.certifications.map((c) => c.workWindowYears));
  const baTotal = input.jobs?.length
    ? baHoursInWindow(input.jobs, asOf, maxWindow)
    : (input.baHours ?? 0);
  if (kaTotal > 0 && kaTotal > baTotal) {
    warnings.push(
      `Knowledge-area hours (${fmt(kaTotal)}) exceed total BA hours (${fmt(baTotal)}). ` +
        "KA hours are a breakdown of your BA hours, not extra hours.",
    );
  }

  const excluded = (input.pdEntries ?? []).filter((e) => rules.pdExcludedTypes.includes(e.type));
  if (excluded.length) {
    const hrs = excluded.reduce((s, e) => s + e.hours, 0);
    warnings.push(
      `${fmt(hrs)} PD hour(s) were not counted: self-study, reading and work experience do not qualify.`,
    );
  }

  if (input.jobs?.length) {
    const active = input.jobs.filter(
      (j) => !j.end || parseISODate(j.end) >= asOf,
    );
    const weekly = active.reduce((s, j) => s + j.hoursPerWeek, 0);
    if (weekly > 60) {
      warnings.push(
        `Your current jobs add up to ${weekly} hours/week. IIBA may question overlapping roles.`,
      );
    }
  }

  return warnings;
}

/** Main entry point. Throws EligibilityInputError on invalid input. */
export function checkEligibility(input: CandidateInput, rules: RuleSet): EligibilityReport {
  const errors = validateInput(input);
  if (errors.length) throw new EligibilityInputError(errors);

  const asOfStr = input.asOf ?? todayISO();
  const asOf = parseISODate(asOfStr);

  const results = [...rules.certifications]
    .sort((a, b) => a.level - b.level)
    .map((rule) => checkCert(rule, input, rules, asOf));

  const eligible = results.filter((r) => r.eligible);
  const recommended = eligible.length ? eligible[eligible.length - 1]!.code : null;

  return {
    asOf: asOfStr,
    rulesVersion: rules.version,
    results,
    recommended,
    warnings: buildWarnings(input, rules, asOf),
  };
}
