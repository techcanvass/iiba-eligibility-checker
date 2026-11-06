import { useEffect, useRef, useState } from "react";
import {
  BUNDLED_RULES,
  buildFinderReport,
  loadRules,
  validateFinderStep1,
  validatePrecise,
  type FinderAnswers,
  type FinderError,
  type FinderQuestion,
  type FinderReport,
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
  onReport?: (report: FinderReport, answers: FinderAnswers) => void;
}

let idSeq = 0;

/** Text value of a <select> → typed value, "" → null. Numbers are parsed. */
function parseOpt<T extends string | number>(q: FinderQuestion<T>, raw: string): T | null {
  return q.options.find((o) => String(o.value) === raw)?.value ?? null;
}

interface SelectProps<T extends string | number> {
  id: string;
  /** Question definition from the shared rules file (label, options, placeholder, hint). */
  q: FinderQuestion<T>;
  value: T | null;
  onChange: (v: T | null) => void;
  error?: string;
}

function Select<T extends string | number>({ id, q, value, onChange, error }: SelectProps<T>) {
  const describedBy = [q.hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="tc-field">
      <label htmlFor={id}>{q.label}</label>
      <select
        id={id}
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(parseOpt(q, e.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {q.placeholder !== undefined && <option value="">{q.placeholder}</option>}
        {q.options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {q.hint && <small id={`${id}-hint`}>{q.hint}</small>}
      {error && (
        <small id={`${id}-err`} className="tc-error">
          {error}
        </small>
      )}
    </div>
  );
}

/** Hours inputs are kept as strings so the user can clear a field. */
type HourStrings = { total: string; ka: string[] };
const emptyHours = (n: number): HourStrings => ({ total: "", ka: Array(n).fill("") });
const toNum = (s: string): number | null => (s.trim() === "" ? null : Number(s));

export function CertificationFinder({ rulesUrl, compact, hideIntro, onReport }: CertificationFinderProps) {
  const [uid] = useState(() => `tcf${++idSeq}`);
  const [rules, setRules] = useState<RuleSet>(BUNDLED_RULES);
  const Q = rules.finder.questions;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<FinderAnswers>({
    totalYears: null,
    background: null,
    education: BUNDLED_RULES.finder.questions.education.default ?? "other",
    interest: BUNDLED_RULES.finder.questions.interest.default ?? "unsure",
    activities: [],
    baYears: null,
    baShare: null,
    continuity: null,
    recent: null,
  });
  const [errors, setErrors] = useState<FinderError[]>([]);
  const [report, setReport] = useState<FinderReport | null>(null);

  const hourCerts = rules.certifications
    .filter((c) => c.workHours > 0)
    .sort((a, b) => a.workWindowYears - b.workWindowYears);
  const [hours, setHours] = useState<Record<string, HourStrings>>({});
  const [preciseOpen, setPreciseOpen] = useState(false);

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

  // On step change: bring the panel into view and move focus to its heading (screen readers).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const root = rootRef.current;
    if (root && root.getBoundingClientRect().top < 0) {
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const set = <K extends keyof FinderAnswers>(key: K, value: FinderAnswers[K]) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setErrors((errs) => errs.filter((e) => e.field !== key));
  };
  const errFor = (field: string) => errors.find((e) => e.field === field)?.message;

  const toggleActivity = (i: number) =>
    set(
      "activities",
      answers.activities.includes(i) ? answers.activities.filter((x) => x !== i) : [...answers.activities, i].sort((a, b) => a - b),
    );

  const goToStep2 = () => {
    const errs = validateFinderStep1(answers);
    setErrors(errs);
    if (errs.length) {
      document.getElementById(`${uid}-${errs[0]!.field}`)?.focus();
      return;
    }
    setStep(2);
  };

  const preciseFromInputs = (): FinderAnswers["precise"] => {
    const p: NonNullable<FinderAnswers["precise"]> = {};
    for (const c of hourCerts) {
      const h = hours[c.code];
      if (!h) continue;
      const total = toNum(h.total);
      const ka = h.ka.map(toNum);
      if (total !== null || ka.some((v) => v !== null)) p[c.code] = { total, ka };
    }
    return Object.keys(p).length ? p : undefined;
  };

  const showResults = (withPrecise: boolean) => {
    const final: FinderAnswers = { ...answers, precise: withPrecise ? preciseFromInputs() : undefined };
    if (withPrecise) {
      const errs = validatePrecise(final.precise, rules);
      setErrors(errs);
      if (errs.length) return;
    }
    const r = buildFinderReport(final, rules);
    setReport(r);
    onReport?.(r, final);
    if (step !== 3) setStep(3);
  };

  const setHour = (code: string, index: number | "total", value: string) => {
    setHours((prev) => {
      const cur = prev[code] ?? emptyHours(rules.knowledgeAreas.length);
      const next =
        index === "total" ? { ...cur, total: value } : { ...cur, ka: cur.ka.map((v, i) => (i === index ? value : v)) };
      return { ...prev, [code]: next };
    });
  };

  const preciseErrors = errors.filter((e) => hourCerts.some((c) => e.field.startsWith(`${c.code}.`)));

  return (
    <div ref={rootRef} className={compact ? "tc-finder is-compact" : "tc-finder"}>
      {!hideIntro && (
        <div className="tc-intro">
          <h1>Find your Business Analyst certification</h1>
          <p>
            Tell us about your background and the work you do. We’ll suggest suitable certifications before asking
            about training.
          </p>
        </div>
      )}

      {step === 1 && (
        <section className="tc-panel" aria-labelledby={`${uid}-h`}>
          <Progress step={1} />
          <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1}>
            1. Tell us about yourself
          </h2>
          <p className="tc-subtitle">You don’t need to know certification terminology.</p>
          <div className="tc-grid">
            <Select
              id={`${uid}-totalYears`}
              q={Q.totalYears}
              value={answers.totalYears}
              onChange={(v) => set("totalYears", v)}
              error={errFor("totalYears")}
            />
            <Select
              id={`${uid}-background`}
              q={Q.background}
              value={answers.background}
              onChange={(v) => set("background", v)}
              error={errFor("background")}
            />
            <Select
              id={`${uid}-education`}
              q={Q.education}
              value={answers.education}
              onChange={(v) => set("education", v ?? "other")}
            />
            <Select
              id={`${uid}-interest`}
              q={Q.interest}
              value={answers.interest}
              onChange={(v) => set("interest", v ?? "unsure")}
            />
          </div>
          <div className="tc-hint">
            ECBA has no mandatory work-experience requirement, including for people switching from non-IT careers.
          </div>
          <div className="tc-actions">
            <button type="button" className="tc-primary" onClick={goToStep2}>
              Continue →
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="tc-panel" aria-labelledby={`${uid}-h`}>
          <Progress step={2} />
          <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1}>
            2. Tell us about your work experience
          </h2>
          <p className="tc-subtitle">
            Which activities have you personally performed at work? Select all that apply, even if your job title was
            not “Business Analyst”.
          </p>
          <fieldset className="tc-chips">
            <legend className="tc-sr-only">Activities you have performed</legend>
            {rules.finder.activities.map((act, i) => (
              <label key={act.label} className="tc-chip">
                <input type="checkbox" checked={answers.activities.includes(i)} onChange={() => toggleActivity(i)} />
                <span>
                  <strong>{act.label}</strong>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="tc-grid">
            <Select
              id={`${uid}-baYears`}
              q={Q.baYears}
              value={answers.baYears}
              onChange={(v) => set("baYears", v)}
            />
            <Select
              id={`${uid}-baShare`}
              q={Q.baShare}
              value={answers.baShare}
              onChange={(v) => set("baShare", v)}
            />
            <Select
              id={`${uid}-continuity`}
              q={Q.continuity}
              value={answers.continuity}
              onChange={(v) => set("continuity", v)}
            />
            <Select
              id={`${uid}-recent`}
              q={Q.recent}
              value={answers.recent}
              onChange={(v) => set("recent", v)}
            />
          </div>
          <div className="tc-hint">
            If you have had breaks or your BA work varied by role, the results will show what needs verification rather
            than assuming all employment was relevant.
          </div>
          <div className="tc-actions">
            <button type="button" onClick={() => setStep(1)}>
              ← Back
            </button>
            <button type="button" className="tc-primary" onClick={() => showResults(false)}>
              See my certification matches →
            </button>
          </div>
        </section>
      )}

      {step === 3 && report && (
        <section className="tc-panel" aria-labelledby={`${uid}-h`}>
          <Progress step={2} />
          <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1}>
            Your certification matches
          </h2>
          <p className="tc-subtitle">
            Based on what you do and when you did it. This is an initial assessment, not an official eligibility
            approval.
          </p>

          <div className="tc-banner" aria-live="polite">
            <strong>{report.headline}</strong>
            <p className="tc-fine">{report.detail}</p>
            {report.warnings.map((w) => (
              <p key={w} className="tc-warning">
                {w}
              </p>
            ))}
          </div>

          <div className="tc-resultgrid">
            {report.matches.map((m) => (
              <article key={m.code} className="tc-result">
                <h3>
                  {m.code}
                  <span className={`tc-pill ${m.tone === "neutral" ? "" : m.tone}`}>{m.status}</span>
                </h3>
                <strong>{m.name}</strong>
                <p>{m.description}</p>
                {m.notes.length > 0 && (
                  <ul>
                    {m.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                )}
                <a href={m.url} target="_blank" rel="noopener noreferrer">
                  Official certification details ↗
                </a>
              </article>
            ))}
          </div>

          <div className="tc-advanced">
            <details
              open={preciseOpen || preciseErrors.length > 0}
              onToggle={(e) => setPreciseOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>Want a more precise CCBA / CBAP eligibility check? (Optional)</summary>
              <p>
                Enter estimated qualifying BA work hours within each period, plus the type of work involved. The exact
                hours and their BABOK distribution are needed before eligibility can be confirmed.
              </p>
              <div className="tc-grid">
                {hourCerts.map((c) => (
                  <HourInput
                    key={c.code}
                    id={`${uid}-${c.code}-total`}
                    label={`BA activity hours within the last ${c.workWindowYears} years`}
                    placeholder={`e.g., ${c.workHours}`}
                    value={hours[c.code]?.total ?? ""}
                    onChange={(v) => setHour(c.code, "total", v)}
                    error={errFor(`${c.code}.total`)}
                  />
                ))}
              </div>
              {hourCerts.map((c) => (
                <div key={c.code}>
                  <h3>
                    Activity hours within the last {c.workWindowYears} years ({c.code})
                  </h3>
                  <div className="tc-hours">
                    {rules.knowledgeAreas.map((ka, i) => (
                      <HourInput
                        key={ka.id}
                        id={`${uid}-${c.code}-ka-${i}`}
                        label={rules.finder.kaPlainNames[ka.id]}
                        title={ka.name}
                        placeholder="Hours (optional)"
                        value={hours[c.code]?.ka[i] ?? ""}
                        onChange={(v) => setHour(c.code, i, v)}
                        error={errFor(`${c.code}.ka.${i}`)}
                      />
                    ))}
                  </div>
                  {errFor(`${c.code}.ka`) && <p className="tc-error">{errFor(`${c.code}.ka`)}</p>}
                </div>
              ))}
              <div className="tc-actions">
                <button type="button" className="tc-primary" onClick={() => showResults(true)}>
                  Update assessment
                </button>
              </div>
            </details>
          </div>

          <div className="tc-advanced">
            <details>
              <summary>After choosing a certification: training and application requirements</summary>
              <p>Training is a next step, not something you need to have completed to discover your best-fit certification.</p>
              <ul>
                {hourCerts.map((c) => (
                  <li key={c.code}>
                    <strong>{c.code}:</strong> {c.pdHours} hours of qualifying professional development within{" "}
                    {c.pdWindowYears} years
                    {c.references > 0 ? `, plus ${c.references === 2 ? "two" : c.references} qualifying references` : ""}.
                  </li>
                ))}
                <li>
                  <strong>PMI-PBA:</strong> 35 contact hours of qualifying BA education, and the relevant experience
                  threshold for your education pathway.
                </li>
                <li>
                  <strong>ECBA, AAC, CBDA and CCA:</strong> No mandatory training-hour prerequisite.
                </li>
              </ul>
              <p className="tc-fine">
                Training and references are required at the application stage where applicable. This tool deliberately
                checks experience and certification fit first.
              </p>
            </details>
          </div>

          <div className="tc-actions">
            <button type="button" onClick={() => setStep(2)}>
              ← Edit experience
            </button>
            {!compact && (
              <button type="button" className="tc-primary" onClick={() => window.print()}>
                Print / Save results
              </button>
            )}
          </div>
        </section>
      )}

      <p className="tc-footer">
        Independent guidance based on published IIBA and PMI criteria; final eligibility is determined by the
        certification body. Your answers stay in your browser and are not submitted anywhere.{" "}
        <a href="https://www.iiba.org/business-analysis-certifications/certification-handbooks/" target="_blank" rel="noopener noreferrer">
          IIBA handbook
        </a>{" "}
        ·{" "}
        <a href="https://www.pmi.org/certifications/business-analysis-pba" target="_blank" rel="noopener noreferrer">
          PMI-PBA
        </a>
      </p>
    </div>
  );
}

function Progress({ step }: { step: 1 | 2 }) {
  return (
    <div className="tc-progress" role="img" aria-label={`Step ${step} of 2`}>
      <i className="on" />
      <i className={step === 2 ? "on" : ""} />
    </div>
  );
}

interface HourInputProps {
  id: string;
  label: string;
  title?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

function HourInput({ id, label, title, placeholder, value, onChange, error }: HourInputProps) {
  return (
    <div className="tc-field">
      <label htmlFor={id} title={title}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      {error && (
        <small id={`${id}-err`} className="tc-error">
          {error}
        </small>
      )}
    </div>
  );
}
