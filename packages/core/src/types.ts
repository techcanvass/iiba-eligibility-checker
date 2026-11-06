// ---------- Rules (what IIBA requires) ----------

export type CertCode = "ECBA" | "CCBA" | "CBAP";

export type KnowledgeAreaId =
  | "planning"
  | "elicitation"
  | "lifecycle"
  | "strategy"
  | "radd"
  | "evaluation";

export interface KnowledgeAreaDef {
  id: KnowledgeAreaId;
  name: string;
}

/** Candidate passes if ANY option is satisfied: `count` KAs each with >= `minHoursEach`. */
export interface KnowledgeAreaRule {
  anyOf: Array<{ minHoursEach: number; count: number }>;
}

export interface CertificationRule {
  code: CertCode;
  name: string;
  level: number;
  workHours: number;
  workWindowYears: number;
  pdHours: number;
  pdWindowYears: number;
  knowledgeAreas: KnowledgeAreaRule | null;
  references: number;
  requiresEthicsAgreement: boolean;
  courseUrl?: string;
}

export interface RuleSet {
  version: string;
  lastVerified: string;
  source: string;
  note?: string;
  toVerify?: string[];
  knowledgeAreas: KnowledgeAreaDef[];
  certifications: CertificationRule[];
  pdExcludedTypes: string[];
  finder: FinderConfig;
}

// ---------- Certification finder (guided wizard) ----------

export type FinderCertKind = "open" | "hours" | "knowledge" | "months";

export interface FinderCertDef {
  code: string;
  kind: FinderCertKind;
  name: string;
  description: string;
  url: string;
  /** kind "months" only (PMI-PBA). */
  monthsByEducation?: Partial<Record<Education, number>>;
  windowYears?: number;
  contactHours?: number;
}

export interface FinderOption<T extends string | number = string | number> {
  value: T;
  label: string;
}

/** One question shown by every surface (web, extension, WordPress, Python CLI, Workspace). */
export interface FinderQuestion<T extends string | number = string | number> {
  label: string;
  placeholder?: string;
  hint?: string;
  /** Pre-selected value; omit to require the user to choose. */
  default?: T;
  options: FinderOption<T>[];
}

export interface FinderQuestions {
  totalYears: FinderQuestion<number>;
  background: FinderQuestion<Background>;
  education: FinderQuestion<Education>;
  interest: FinderQuestion<Interest>;
  baYears: FinderQuestion<number>;
  baShare: FinderQuestion<number>;
  continuity: FinderQuestion<Continuity>;
  recent: FinderQuestion<Recency>;
}

export interface FinderConfig {
  /** Hours per year assumed when turning "years × share" into an indicative estimate. */
  annualHoursEstimate: number;
  questions: FinderQuestions;
  kaPlainNames: Record<KnowledgeAreaId, string>;
  activities: Array<{ label: string; ka: KnowledgeAreaId }>;
  certifications: FinderCertDef[];
  interestPriority: Record<Interest, string[]>;
}

export type Background = "ba" | "it" | "domain" | "project" | "student" | "other";
export type Education = "secondary" | "bachelor" | "gac" | "other";
export type Interest = "unsure" | "general" | "agile" | "data" | "cyber" | "project";
export type Continuity = "continuous" | "breaks" | "parttime";
export type Recency = "current" | "lt2" | "2to7" | "7to10" | "over10" | "never";

/** Optional exact hours for an hours-based cert (CCBA/CBAP). `ka` follows rules.knowledgeAreas order. */
export interface PreciseHours {
  total: number | null;
  ka: Array<number | null>;
}

export interface FinderAnswers {
  totalYears: number | null;
  background: Background | null;
  education: Education;
  interest: Interest;
  /** Indices into finder.activities. */
  activities: number[];
  baYears: number | null;
  baShare: number | null;
  continuity: Continuity | null;
  recent: Recency | null;
  /** Keyed by cert code, e.g. { CCBA: {...}, CBAP: {...} }. */
  precise?: Partial<Record<string, PreciseHours>>;
}

export type MatchTone = "good" | "neutral" | "warn";

export interface FinderMatch {
  code: string;
  name: string;
  description: string;
  url: string;
  status: string;
  tone: MatchTone;
  notes: string[];
}

export interface FinderReport {
  headline: string;
  detail: string;
  warnings: string[];
  matches: FinderMatch[];
  rulesVersion: string;
}

// ---------- Candidate input ----------

/** One job/role. Dates are ISO strings (YYYY-MM-DD). `end` omitted = current job. */
export interface JobEntry {
  title?: string;
  start: string;
  end?: string;
  hoursPerWeek: number; // e.g. 40
  baPercent: number; // 0–100, share of time spent on BA work
}

export type PdType =
  | "course"
  | "workshop"
  | "webinar"
  | "conference"
  | "self-study"
  | "reading"
  | "work-experience";

export interface PdEntry {
  title?: string;
  hours: number;
  completedOn: string; // ISO date
  type: PdType;
}

export type KnowledgeAreaHours = Partial<Record<KnowledgeAreaId, number>>;

/**
 * Input accepted by the checker. Either give `baHours` directly or `jobs`
 * (jobs win when both are present), and either `pdHours` directly or `pdEntries`.
 */
export interface CandidateInput {
  asOf?: string; // ISO date; defaults to today
  baHours?: number;
  jobs?: JobEntry[];
  pdHours?: number;
  pdEntries?: PdEntry[];
  kaHours?: KnowledgeAreaHours;
  /** When omitted, references are reported as an application-stage item, not checked. */
  references?: number;
  agreesToEthics: boolean;
}

// ---------- Result ----------

export type RequirementId = "work" | "pd" | "knowledgeAreas" | "references" | "ethics";

export interface RequirementResult {
  id: RequirementId;
  label: string;
  met: boolean;
  required: number;
  actual: number;
  /** Human-readable explanation of what is still missing (empty when met). */
  gap: string;
}

export interface CertResult {
  code: CertCode;
  name: string;
  eligible: boolean;
  requirements: RequirementResult[];
  /** Estimated date the work-hours rule will be met at the candidate's current pace, if computable. */
  projectedEligibleOn?: string;
  courseUrl?: string;
}

export interface EligibilityReport {
  asOf: string;
  rulesVersion: string;
  results: CertResult[];
  /** Highest-level cert the candidate is eligible for, if any. */
  recommended: CertCode | null;
  warnings: string[];
}
