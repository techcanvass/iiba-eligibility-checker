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
  advisor: AdvisorConfig;
}

// ---------- Career advisor (guided questions → pathway) ----------

export type AdvisorExperience = "none" | "lt2" | "2to4" | "5plus";
export type AdvisorBackground = "nonit" | "it" | "student";
export type AdvisorGoal =
  | "career"
  | "agile"
  | "data"
  | "technical"
  | "ai"
  | "agents"
  | "cyber"
  | "domain"
  | "unsure";

/** Follow-up question keys, asked only for some goals. */
export type AdvisorFollowUp = "agile" | "domain" | "analytics" | "cyber" | "ai";

export interface AdvisorAnswers {
  experience: AdvisorExperience | null;
  /** Asked only when experience is "none". */
  background?: AdvisorBackground | null;
  /** Asked only when the person has BA experience. */
  goal?: AdvisorGoal | null;
  agile?: "agile" | "product" | "both" | null;
  domain?: "banking" | "insurance" | "health" | "supply" | "telecom" | "unsure" | null;
  analytics?: "cert" | "hands" | "both" | null;
  cyber?: "securityba" | "transition" | null;
  ai?: "productivity" | "agents" | "both" | null;
}

export interface AdvisorOption {
  value: string;
  label: string;
}

export interface AdvisorQuestion {
  title: string;
  helper: string;
  options: AdvisorOption[];
}

export interface AdvisorCourse {
  name: string;
  desc: string;
  url: string;
  /** Credential is issued by someone else; the link goes to that issuer. */
  external?: boolean;
  issuer?: string;
  issuerUrl?: string;
}

export interface AdvisorConfig {
  questions: Record<"experience" | "background" | "agile" | "domain" | "analytics" | "cyber" | "ai", AdvisorQuestion>;
  /** Goal choices in display order; `hideFor` lists experience brackets that don't see the goal. */
  goals: Array<{ value: AdvisorGoal; label: string; hideFor?: AdvisorExperience[] }>;
  courses: Record<string, AdvisorCourse>;
  sourceLinks: Array<{ label: string; url: string }>;
}

export type AdvisorCourseRole = "primary" | "also" | "optional";

export interface AdvisorCourseRef extends AdvisorCourse {
  key: string;
  role: AdvisorCourseRole;
}

export interface AdvisorReport {
  title: string;
  intro: string;
  reason: string;
  roadmap: string[];
  courses: AdvisorCourseRef[];
  /** Two short points: market context and credential credibility. */
  why: string[];
  /** Eligibility and scope note. */
  notice: string;
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
