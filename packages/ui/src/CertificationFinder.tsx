import { useEffect, useRef, useState } from "react";
import {
  ADVISOR_FOLLOW_UPS,
  BUNDLED_RULES,
  advisorStepCount,
  buildAdvisorReport,
  goalsFor,
  loadRules,
  nextAdvisorStage,
  type AdvisorAnswers,
  type AdvisorFollowUp,
  type AdvisorReport,
  type AdvisorStage,
  type RuleSet,
} from "@iiba/core";

export interface CertificationFinderProps {
  /** Hosted rules JSON. Omit to use the bundled copy only. */
  rulesUrl?: string;
  /** Tighter layout for narrow containers like an extension popup (also hides Print). */
  compact?: boolean;
  /** Hide the page title + intro (e.g. when the host page already has one). */
  hideIntro?: boolean;
  /** Called with every result — hook analytics or lead capture here. */
  onReport?: (report: AdvisorReport, answers: AdvisorAnswers) => void;
}

type QuestionStage = Exclude<AdvisorStage, "result">;

const EMPTY: AdvisorAnswers = { experience: null };

/** Answer keys that belong to later questions and must be cleared when an earlier one changes. */
function clearDownstream(stage: QuestionStage, a: AdvisorAnswers): AdvisorAnswers {
  const next = { ...a };
  if (stage === "experience") {
    delete next.background;
    delete next.goal;
  }
  if (stage === "experience" || stage === "goal") {
    for (const k of ADVISOR_FOLLOW_UPS) delete next[k];
  }
  return next;
}

export function CertificationFinder({ rulesUrl, compact, hideIntro, onReport }: CertificationFinderProps) {
  const [rules, setRules] = useState<RuleSet>(BUNDLED_RULES);
  const [answers, setAnswers] = useState<AdvisorAnswers>(EMPTY);
  const [history, setHistory] = useState<QuestionStage[]>([]);
  const [stage, setStage] = useState<AdvisorStage>("experience");
  const [report, setReport] = useState<AdvisorReport | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!rulesUrl) return;
    let cancelled = false;
    loadRules({ url: rulesUrl }).then((r) => {
      if (!cancelled) setRules(r.rules);
    });
    return () => {
      cancelled = true;
    };
  }, [rulesUrl]);

  // On every screen change: bring the panel into view and move focus to its heading (screen readers).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const root = rootRef.current;
    if (root && root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: "smooth", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const Q = rules.advisor.questions;
  const total = advisorStepCount(answers);
  const done = stage === "result";

  const choose = (value: string) => {
    if (stage === "result") return;
    const key = stage as keyof AdvisorAnswers;
    setAnswers((a) => ({ ...clearDownstream(stage, a), [key]: value }) as AdvisorAnswers);
  };

  const next = () => {
    if (stage === "result" || !answers[stage as keyof AdvisorAnswers]) return;
    const n = nextAdvisorStage(stage, answers);
    setHistory((h) => [...h, stage as QuestionStage]);
    setStage(n);
    if (n === "result") {
      const r = buildAdvisorReport(answers as AdvisorAnswers, rules);
      setReport(r);
      onReport?.(r, answers);
    }
  };

  const back = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setStage(prev);
  };

  const restart = () => {
    setAnswers(EMPTY);
    setHistory([]);
    setStage("experience");
    setReport(null);
  };

  const label = (list: { value: string; label: string }[], v: string | null | undefined) =>
    list.find((o) => o.value === v)?.label ?? "Not selected";
  const goals = goalsFor(rules, answers.experience);
  const followUp = ADVISOR_FOLLOW_UPS.find((k) => answers[k]);

  const summary: Array<[string, string]> = [
    ["BA experience", label(Q.experience.options, answers.experience)],
    [
      "Professional background",
      answers.experience === "none"
        ? label(Q.background.options, answers.background)
        : answers.experience
          ? "Working with hands-on BA responsibilities"
          : "Not selected",
    ],
    [
      "Career goal",
      answers.experience === "none" ? "Transition into a BA role" : label(rules.advisor.goals, answers.goal),
    ],
    ["Specialization", followUp ? label(Q[followUp as AdvisorFollowUp].options, answers[followUp]) : "—"],
  ];

  const pct = done ? 100 : Math.round((history.length / total) * 100);

  return (
    <div ref={rootRef} className={compact ? "tc-finder is-compact" : "tc-finder"}>
      {!hideIntro && (
        <div className="tc-intro">
          <h1>Find the right Business Analysis path</h1>
          <p>
            Tell us about your experience and career goals. Get a personalized certification recommendation, a
            practical skills roadmap, and relevant Techcanvass courses.
          </p>
        </div>
      )}

      <div className="tc-layout">
        <div className="tc-panel">
          {!done && (
            <QuestionView
              key={stage}
              stage={stage}
              rules={rules}
              goals={goals}
              value={answers[stage as keyof AdvisorAnswers] as string | null | undefined}
              step={history.length + 1}
              isLast={nextAdvisorStage(stage, answers) === "result"}
              canBack={history.length > 0}
              headingRef={headingRef}
              onChoose={choose}
              onNext={next}
              onBack={back}
            />
          )}

          {done && report && (
            <ResultView
              report={report}
              rules={rules}
              compact={!!compact}
              headingRef={headingRef}
              onEdit={back}
              onRestart={restart}
            />
          )}
        </div>

        {!compact && (
          <aside className="tc-aside" aria-label="Your advisor profile">
            <h3>Your advisor profile</h3>
            <div
              className="tc-progressbar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="tc-small">
              {done ? "Advisor complete" : `Question ${history.length + 1} of ${total} (some paths are shorter)`}
            </p>
            {summary.map(([k, v]) => (
              <div className="tc-meta" key={k}>
                <span className="tc-meta-label">{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
            <span className="tc-pill">Personalized recommendations</span>
          </aside>
        )}
      </div>

      {compact && !done && (
        <div className="tc-progressbar tc-progressbar-compact" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

interface QuestionViewProps {
  stage: QuestionStage;
  rules: RuleSet;
  goals: ReturnType<typeof goalsFor>;
  value: string | null | undefined;
  step: number;
  isLast: boolean;
  canBack: boolean;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onChoose: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function QuestionView({ stage, rules, goals, value, step, isLast, canBack, headingRef, onChoose, onNext, onBack }: QuestionViewProps) {
  const q = stage === "goal" ? undefined : rules.advisor.questions[stage];
  const options = stage === "goal" ? goals : (q?.options ?? []);
  const title = stage === "goal" ? "What is your next career goal?" : (q?.title ?? "");
  const helper = stage === "goal" ? "Choose the outcome that matters most to you right now." : (q?.helper ?? "");

  return (
    <section aria-labelledby="tc-q-title">
      <div className="tc-eyebrow">Question {step} · Your career profile</div>
      <h2 className="tc-question" id="tc-q-title" tabIndex={-1} ref={headingRef}>
        {title}
      </h2>
      <p className="tc-helper">{helper}</p>

      <div className="tc-options" role="radiogroup" aria-label="Choose one answer">
        {options.map((o, i) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? "tc-option is-selected" : "tc-option"}
              onClick={() => onChoose(o.value)}
            >
              <span className="tc-letter" aria-hidden="true">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>

      <div className="tc-actions">
        <button
          type="button"
          className="tc-btn tc-secondary"
          onClick={onBack}
          disabled={!canBack}
          style={{ visibility: canBack ? "visible" : "hidden" }}
        >
          ← Back
        </button>
        <button type="button" className="tc-btn tc-primary" onClick={onNext} disabled={!value}>
          {isLast ? "See my recommendations →" : "Continue →"}
        </button>
      </div>
    </section>
  );
}

const ROLE_FLAG = { primary: "Primary recommendation", also: "Also recommended", optional: "Optional / complementary" } as const;

interface ResultViewProps {
  report: AdvisorReport;
  rules: RuleSet;
  compact: boolean;
  headingRef: React.RefObject<HTMLHeadingElement>;
  onEdit: () => void;
  onRestart: () => void;
}

function ResultView({ report, rules, compact, headingRef, onEdit, onRestart }: ResultViewProps) {
  return (
    <section className="tc-results" aria-labelledby="tc-r-title">
      <div className="tc-eyebrow">Your personalized BA career pathway</div>
      <h2 className="tc-result-title" id="tc-r-title" tabIndex={-1} ref={headingRef}>
        {report.title}
      </h2>
      <p className="tc-lead">{report.intro}</p>

      <div className="tc-card">
        <h3>Your step-by-step learning roadmap</h3>
        <ol>
          {report.roadmap.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </div>

      <div className="tc-card">
        <h3>Recommended certification and courses</h3>
        {report.courses.map((c) => (
          <div className="tc-course" key={c.key}>
            <div>
              <span className="tc-flag">{ROLE_FLAG[c.role]}</span>
              <h4>{c.name}</h4>
              <p>{c.desc}</p>
              {c.issuerUrl && (
                <div className="tc-issuer">
                  <a href={c.issuerUrl} target="_blank" rel="noopener noreferrer">
                    View credential at {c.issuer} ↗
                  </a>
                </div>
              )}
            </div>
            <a className="tc-course-link" href={c.url} target="_blank" rel="noopener noreferrer">
              {c.external ? "Official issuer ↗" : "Explore course ↗"}
            </a>
          </div>
        ))}
      </div>

      <div className="tc-card">
        <h3>Why this recommendation?</h3>
        <p className="tc-reason">{report.reason}</p>
        <ul className="tc-why">
          {report.why.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="tc-source-note">
          Market context is indicative, not a guarantee of hiring demand. Credential recognition varies by employer
          and country.{" "}
          {rules.advisor.sourceLinks.map((l, i) => (
            <span key={l.url}>
              {i > 0 && " · "}
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            </span>
          ))}
        </p>
      </div>

      <div className="tc-card">
        <h3>Eligibility &amp; scope</h3>
        <div className="tc-caution">{report.notice}</div>
      </div>

      <div className="tc-actions tc-no-print">
        <button type="button" className="tc-btn tc-secondary" onClick={onEdit}>
          ← Review answers
        </button>
        <div className="tc-actions-right">
          {!compact && (
            <button type="button" className="tc-btn tc-secondary" onClick={() => window.print()}>
              Print / Save PDF
            </button>
          )}
          <button type="button" className="tc-btn tc-primary" onClick={onRestart}>
            Start again ↻
          </button>
        </div>
      </div>

      <p className="tc-footnote">
        Recommendations are guidance, not a guarantee of exam eligibility, admission, or employment. IIBA issues
        ECBA, CCBA, CBAP, AAC, CBDA and CPOA credentials; Techcanvass provides relevant preparation/training. Confirm
        current official eligibility and requirements before applying.
      </p>
    </section>
  );
}
