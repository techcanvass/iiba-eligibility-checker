import type {
  AdvisorAnswers,
  AdvisorFollowUp,
  AdvisorGoal,
  AdvisorReport,
  AdvisorCourseRef,
  RuleSet,
} from "./types";
import { formatNumber } from "./format";

export interface AdvisorError {
  field: string;
  message: string;
}

export class AdvisorInputError extends Error {
  constructor(public readonly errors: AdvisorError[]) {
    super(errors.map((e) => e.message).join("; "));
    this.name = "AdvisorInputError";
  }
}

/** Follow-up question asked after each goal (goals not listed have none). */
const FOLLOW_UP: Partial<Record<AdvisorGoal, AdvisorFollowUp>> = {
  agile: "agile",
  domain: "domain",
  data: "analytics",
  cyber: "cyber",
  ai: "ai",
  agents: "ai",
};

export const ADVISOR_FOLLOW_UPS: readonly AdvisorFollowUp[] = ["agile", "domain", "analytics", "cyber", "ai"];

export type AdvisorStage = "experience" | "background" | "goal" | AdvisorFollowUp | "result";

/** Which question comes after `stage`, given the answers so far. Shared by every surface. */
export function nextAdvisorStage(stage: AdvisorStage, a: Partial<AdvisorAnswers>): AdvisorStage {
  if (stage === "experience") return a.experience === "none" ? "background" : "goal";
  if (stage === "goal") return (a.goal && FOLLOW_UP[a.goal]) || "result";
  return "result";
}

/** Number of questions on this person's path (some paths are shorter). */
export function advisorStepCount(a: Partial<AdvisorAnswers>): number {
  if (a.experience === "none") return 2;
  return a.goal && FOLLOW_UP[a.goal] ? 3 : 2;
}

/** Goals shown for an experience bracket. */
export function goalsFor(rules: RuleSet, experience: AdvisorAnswers["experience"]) {
  return rules.advisor.goals.filter((g) => !experience || !g.hideFor?.includes(experience));
}

/** Check that every question on the person's path has an allowed answer. */
export function validateAdvisorAnswers(a: Partial<AdvisorAnswers>, rules: RuleSet): AdvisorError[] {
  const errors: AdvisorError[] = [];
  const Q = rules.advisor.questions;
  const check = (field: keyof AdvisorAnswers, allowed: string[]) => {
    const v = a[field];
    if (v === null || v === undefined || (v as string) === "") {
      errors.push({ field, message: "Please choose an answer." });
    } else if (!allowed.includes(v as string)) {
      errors.push({ field, message: `"${String(v)}" is not an allowed answer.` });
    }
  };
  check("experience", Q.experience.options.map((o) => o.value));
  if (!a.experience || errors.length) return errors;

  if (a.experience === "none") {
    check("background", Q.background.options.map((o) => o.value));
    return errors;
  }
  check("goal", goalsFor(rules, a.experience).map((g) => g.value));
  const follow = a.goal ? FOLLOW_UP[a.goal] : undefined;
  if (!errors.length && follow) check(follow, Q[follow].options.map((o) => o.value));
  return errors;
}

const unique = <T>(list: T[]): T[] => [...new Set(list)];

interface Pick {
  title: string;
  intro: string;
  reason: string;
  roadmap: string[];
  main: string[];
  extra: string[];
  notice: string;
}

/** Build the pathway for a set of answers. Pure: same answers + rules give the same report. */
export function buildAdvisorReport(input: AdvisorAnswers, rules: RuleSet): AdvisorReport {
  const errors = validateAdvisorAnswers(input, rules);
  if (errors.length) throw new AdvisorInputError(errors);

  const a = input;
  const pick = a.experience === "none" ? beginnerPick(a, rules) : experiencedPick(a, rules);
  const main = unique(pick.main);
  const extra = unique(pick.extra.filter((k) => !main.includes(k)));

  const courses: AdvisorCourseRef[] = [...main, ...extra].map((key, i) => {
    const course = rules.advisor.courses[key];
    if (!course) throw new Error(`Rules are missing course "${key}"`);
    return { key, ...course, role: i === 0 ? "primary" : i < main.length ? "also" : "optional" };
  });

  return {
    title: pick.title,
    intro: pick.intro,
    reason: pick.reason,
    roadmap: pick.roadmap,
    courses,
    why: whyReasons(main, a),
    notice: pick.notice,
    rulesVersion: rules.version,
  };
}

function beginnerPick(a: AdvisorAnswers, rules: RuleSet): Pick {
  void rules;
  const bg = a.background;
  const base = baseSteps();
  return {
    title: "Your recommended path: BA foundation + ECBA",
    intro:
      bg === "it"
        ? "You already have exposure to IT systems and the SDLC. Add core BA skills, tools, portfolio projects and an entry-level credential to support a BA transition."
        : bg === "student"
          ? "As a student or fresher, start with BA fundamentals and demonstrable project work before seeking entry-level BA positions."
          : "Use your industry experience as a strength and develop the technical and analytical skills needed to move into Business Analysis.",
    reason:
      "ECBA plus practical BA skills suits everyone who is starting out in Business Analysis. Domain training is an optional add-on, especially if you already have industry experience.",
    roadmap: [
      bg === "it"
        ? "Refresh SDLC, software delivery and the BA role as needed."
        : "Learn SDLC concepts, information systems, Agile and basic software delivery.",
      ...base.slice(1, 3),
      "Learn API fundamentals and how integrations work.",
      "Practice AI-assisted BA tasks, reviewing outputs for correctness and confidentiality.",
      "Complete at least two practical BA projects with documentation and tools.",
      "Build a portfolio and prepare a BA-focused résumé and interviews.",
      "Prepare for the IIBA ECBA exam and confirm current examination requirements.",
    ],
    main: ["ecba"],
    extra: ["domain"],
    notice:
      "ECBA is an entry-level IIBA credential. The actual ECBA exam/credential is issued by IIBA, not Techcanvass. If you are transitioning from a non-IT field, allow extra time for SDLC and systems fundamentals.",
  };
}

function baseSteps(): string[] {
  return [
    "Clarify your BA career target and identify the roles you want to apply for.",
    "Strengthen core BA techniques: stakeholder elicitation, requirements, business process models and solution evaluation.",
    "Practice with Jira, MS Visio and structured requirement documents.",
    "Build at least two realistic case-study projects and a portfolio.",
  ];
}

function hoursNote(rules: RuleSet, code: "CCBA" | "CBAP"): string {
  const r = rules.certifications.find((c) => c.code === code);
  return r ? formatNumber(r.workHours) : "";
}

function experiencedPick(a: AdvisorAnswers, rules: RuleSet): Pick {
  const e = a.experience;
  const goal = a.goal as AdvisorGoal;
  const baseline = e === "lt2" ? "ECBA" : e === "2to4" ? "CCBA" : "CBAP";
  const baseCourse = e === "lt2" ? "ecba" : e === "2to4" ? "ccba" : "cbap";
  const stageText = e === "lt2" ? "early-career BA" : e === "2to4" ? "developing BA professional" : "experienced BA professional";

  const p: Pick = {
    title: `Your recommended path: ${baseline} and applied BA skills`,
    intro: `As a ${stageText}, focus on advancing your current BA capability while preparing for the next appropriate credential.`,
    reason: `Your experience bracket suggests ${baseline} as a certification to explore; eligibility for CCBA/CBAP requires verified work hours and other IIBA conditions, not years alone.`,
    roadmap: [
      "Map your current responsibilities to BABOK knowledge areas.",
      "Identify experience, skills and evidence gaps for your intended BA role.",
      "Improve elicitation, analysis, process modeling, solution evaluation and stakeholder management.",
      "Apply techniques to a live initiative or documented portfolio case study.",
      "Check IIBA eligibility and pursue the right exam preparation path.",
    ],
    main: [baseCourse],
    extra: ["aiba"],
    notice: "",
  };

  switch (goal) {
    case "career":
      break;
    case "agile": {
      const ag = a.agile;
      p.main = ag === "product" ? ["cpoa"] : ag === "both" ? ["aac", "cpoa"] : ["aac"];
      p.extra = ag === "product" || ag === "both" ? ["cspo", "pspo", baseCourse] : [baseCourse];
      p.title =
        ag === "product"
          ? "Your recommended path: Product Ownership (CPOA)"
          : ag === "both"
            ? "Your recommended path: Agile Analysis + Product Ownership"
            : "Your recommended path: Agile BA (AAC)";
      p.intro = "Build confidence in Agile delivery and/or product ownership with a focused IIBA specialty path.";
      p.roadmap = [
        "Learn Agile principles, Scrum roles, ceremonies and iterative delivery.",
        "Practice writing user stories, acceptance criteria and managing a backlog.",
        ag === "agile"
          ? "Apply Agile analysis at strategy, initiative and delivery horizons."
          : "Practice customer discovery, prioritization, product vision and roadmap decisions.",
        "Use the learning in a cross-functional project or simulated product.",
        "Compare CPOA, CSPO and PSPO I by learning style and career goals, then prepare for your chosen certification.",
      ];
      p.reason =
        "AAC aligns to Agile analysis; CPOA aligns to product ownership and value delivery. The best one depends on your desired role.";
      break;
    }
    case "data":
      p.main = a.analytics === "hands" ? ["analytics"] : a.analytics === "cert" ? ["cbda"] : ["analytics", "cbda"];
      p.extra = [baseCourse];
      p.title = "Your recommended path: Business Data Analytics";
      p.intro = "Combine business problem framing with analytics capability and evidence-based decision-making.";
      p.roadmap = [
        "Translate business problems into research questions and measurable KPIs.",
        "Learn to source, clean and assess data quality.",
        "Build practical SQL, reporting and Power BI skills.",
        "Present actionable recommendations with a portfolio analytics project.",
        "If pursuing CBDA, prepare against the IIBA business data analytics domains.",
      ];
      p.reason =
        "CBDA is designed around business data analytics competencies, while Techcanvass Data Analytics & AI is a practical, tool-focused learning option.";
      break;
    case "technical":
      p.main = ["technical"];
      p.extra = [baseCourse];
      p.title = "Your recommended path: Technical Business Analyst";
      p.intro =
        "Become more effective at translating business needs into systems, data, API and integration requirements.";
      p.roadmap = [
        "Consolidate requirements engineering, process modeling and stakeholder management.",
        "Learn SQL, data modeling, data mapping and database fundamentals.",
        "Understand REST APIs, integration concepts and how to test interface requirements.",
        "Build basic systems/cloud and security-awareness skills.",
        "Document a technical BA case study with use cases, API flows and acceptance criteria.",
      ];
      p.reason =
        "Techcanvass offers a Technical Business Analyst course focused on the systems and technology capabilities needed in technical BA roles.";
      break;
    case "ai":
      p.main = a.ai === "agents" ? ["agents"] : a.ai === "both" ? ["aiba", "agents"] : ["aiba"];
      p.extra = [baseCourse];
      p.title = "Your recommended path: AI-enabled Business Analyst";
      p.intro =
        "Use AI responsibly to improve your day-to-day BA productivity, with an optional deeper path into agent development.";
      p.roadmap = [
        "Learn generative AI basics, strengths, limitations and data handling requirements.",
        "Practice AI-assisted requirements, user stories, workshops and documentation.",
        "Validate outputs, maintain human review and protect confidential information.",
        "Complete an AI-supported BA case study.",
        ...(a.ai === "both" || a.ai === "agents" ? ["Prototype a low-code AI agent for a real business workflow."] : []),
      ];
      p.reason =
        "The Techcanvass AI BA course focuses on BA productivity and AI opportunities; its AI Agents course develops implementation skills.";
      break;
    case "agents":
      p.main = a.ai === "productivity" ? ["aiba", "agents"] : ["agents", "aiba"];
      p.extra = [baseCourse];
      p.title = "Your recommended path: AI Agents and Solutions";
      p.intro = "Move from describing AI use cases to prototyping low-code AI agents and workflows.";
      p.roadmap = [
        "Map a business process and identify a high-value agent use case.",
        "Learn AI agent fundamentals, prompts, tools, workflows and guardrails.",
        "Build a low-code single-agent prototype.",
        "Extend it to an orchestrated workflow and test failure cases.",
        "Demonstrate an end-to-end AI solution with human oversight and success metrics.",
      ];
      p.reason = "Techcanvass has a dedicated AI Agents course for Business Analysts, Managers and Product Owners.";
      break;
    case "domain": {
      p.main = ["domain"];
      p.extra = [baseCourse];
      p.title = "Your recommended path: Domain-specialist BA";
      const label = rules.advisor.questions.domain.options.find((o) => o.value === a.domain)?.label ?? "";
      p.intro = `Strengthen your industry vocabulary, business processes, rules and stakeholder context${
        a.domain === "unsure" ? "." : ` in ${label.toLowerCase()}.`
      }`;
      p.roadmap = [
        "Choose a target domain aligned with your experience and BA opportunities.",
        "Learn the industry operating model, key processes, regulatory context and terminology.",
        "Model a core domain workflow and the related business rules.",
        "Produce requirements and a portfolio case study within that domain.",
        "Combine industry specialization with your appropriate BA certification.",
      ];
      p.reason =
        "Techcanvass offers domain training across banking, payments, insurance, healthcare, capital markets, supply chain and related areas.";
      break;
    }
    case "cyber":
      p.main = ["technical"];
      p.extra = [baseCourse];
      p.title = "Your recommended path: Cybersecurity-aware Business Analyst";
      p.intro =
        "Develop BA skills for security-focused initiatives; technical systems training can provide a useful foundation.";
      p.roadmap = [
        "Understand security-related BA responsibilities, stakeholders and control requirements.",
        "Learn fundamentals of access control, privacy, risk assessment and secure system design.",
        "Practice documenting security requirements, risk scenarios and acceptance criteria.",
        "Build a portfolio case study for a security-focused change initiative.",
        "Evaluate independently verified security-specific credentials based on your target job.",
      ];
      p.reason =
        "The verified Techcanvass catalogue includes Technical BA training but does not establish a dedicated cybersecurity certification. We therefore suggest transferable skills rather than claim a Techcanvass cybersecurity credential.";
      p.notice =
        "For a cybersecurity-specific certification, review the current requirements from the relevant certification body. Technical BA training is not a substitute for specialist cybersecurity certification.";
      break;
    case "unsure":
      p.main = [baseCourse];
      p.extra = ["aiba", "catalog"];
      p.title = "Your recommended path: Strengthen your BA foundation";
      p.intro = "Start with the certification that fits your experience stage, then sample specialization topics before committing.";
      p.roadmap = [
        "Review your experience against BA roles and certification eligibility.",
        "Complete a BABOK-aligned skills gap review.",
        "Explore short sample projects in Agile, technical BA, analytics and AI.",
        "Choose the specialization best aligned with your work opportunities.",
        "Prepare for the certification supported by your verified experience.",
      ];
      p.reason =
        "A broad BA credential provides a useful starting point when your specialist career direction is not yet clear.";
      break;
  }

  if (!p.notice) {
    p.notice =
      e === "2to4"
        ? `CCBA requires at least ${hoursNote(rules, "CCBA")} qualifying BA work hours within the specified lookback period plus additional IIBA criteria. Two years of employment alone does not establish eligibility. If you are not yet eligible, build experience and consider ECBA or specialty learning in the meantime.`
        : e === "5plus"
          ? `CBAP requires at least ${hoursNote(rules, "CBAP")} qualifying BA work hours within the specified lookback period plus additional IIBA criteria. Five calendar years by itself does not prove eligibility; consider CCBA if your verified hours better align.`
          : "For early-career professionals, ECBA is typically a sensible general BA credential to explore. Specialty certificates may also be suitable depending on role and preparation.";
  }
  return p;
}

/** Two short points: market context and credential credibility. */
function whyReasons(main: string[], a: AdvisorAnswers): string[] {
  const has = (...keys: string[]) => keys.some((k) => main.includes(k));
  if (a.goal === "agile" && (a.agile === "product" || a.agile === "both")) {
    return [
      "Market demand: Product Owner roles emphasize Agile/Scrum delivery, backlog prioritization, customer value and stakeholder alignment. Recent job-posting datasets identify Agile as a frequent requirement; hands-on product examples remain important.",
      "Credibility: IIBA-CPOA is issued by IIBA and focuses on product ownership analysis. CSPO is issued by Scrum Alliance through an approved trainer-led course; PSPO I is issued by Scrum.org through a knowledge assessment. These are established issuer-led credentials, but employer preference varies.",
    ];
  }
  if (has("aac")) {
    return [
      "Market demand: Agile teams need analysts who can clarify user needs, shape backlogs and work closely with delivery teams; practice with user stories and acceptance criteria is valuable.",
      "Credibility: IIBA-AAC is an official specialty credential from the International Institute of Business Analysis, making it relevant to analysts seeking to demonstrate Agile analysis knowledge.",
    ];
  }
  if (has("cbda", "analytics")) {
    return [
      "Market demand: Employers value professionals who can turn business questions into measurable insights, communicate findings and work with data tools such as SQL and reporting platforms.",
      "Credibility: IIBA-CBDA is an issuer-backed business data analytics certification; practical analytics courses demonstrate applied capability but are not interchangeable with a professional certification.",
    ];
  }
  if (has("technical")) {
    return [
      "Market demand: Systems integration, APIs, data flows and technical requirements are recurring capabilities for technology-facing BA roles; demonstrable project work supports job readiness.",
      "Credibility: Technical BA training is a practical skills pathway rather than a separately issued IIBA credential. Pair it with an appropriate BA certification if external credential recognition is your priority.",
    ];
  }
  if (has("aiba", "agents")) {
    return [
      "Market demand: AI-assisted research, requirements drafting and workflow automation are emerging skills, while employers still expect validation, security awareness and business judgment.",
      "Credibility: These Techcanvass programs develop applied AI skills. Their course completion should not be confused with an IIBA-issued professional certification; a portfolio helps demonstrate capability.",
    ];
  }
  if (has("domain")) {
    return [
      "Market demand: Industry knowledge helps analysts interpret workflows, regulations and stakeholder needs in specialized sectors such as banking, healthcare or insurance.",
      "Credibility: Domain Training Courses provide specialization; they are learning programs, not a substitute for independently issued BA credentials such as ECBA, CCBA or CBAP.",
    ];
  }
  if (has("ecba", "ccba", "cbap")) {
    return [
      "Market demand: Requirements, stakeholder communication, process analysis and solution evaluation are core BA skills across digital transformation and software-delivery roles.",
      "Credibility: ECBA, CCBA and CBAP are issued by IIBA. ECBA is an entry-level option; CCBA and CBAP signal progressively more experienced BA practice, subject to IIBA eligibility rules.",
    ];
  }
  return [
    "Market demand: Employers value analysts who combine clear business requirements, stakeholder collaboration and practical delivery examples.",
    "Credibility: Choose a recognized issuer-backed credential for formal validation and pair it with applied training and portfolio projects to demonstrate the skills relevant to your target role.",
  ];
}
