import { useEffect, useRef, useState } from "react";
import {
  BUNDLED_RULES,
  buildFinderReport,
  loadRules,
  validateFinderStep1,
  validatePrecise,
  type Background,
  type Continuity,
  type Education,
  type FinderAnswers,
  type FinderError,
  type FinderReport,
  type Interest,
  type Recency,
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

type Opt<T extends string | number> = { value: T; label: string };

const TOTAL_YEARS: Opt<number>[] = [
  { value: 0, label: "Just starting / no experience" },
  { value: 1, label: "Less than 1 year" },
  { value: 2, label: "1–2 years" },
  { value: 4, label: "3–4 years" },
  { value: 6, label: "5–7 years" },
  { value: 9, label: "8–10 years" },
  { value: 12, label: "More than 10 years" },
];
const BACKGROUNDS: Opt<Background>[] = [
  { value: "ba", label: "Working as a Business Analyst" },
  { value: "it", label: "IT / Software / Testing / Product" },
  { value: "domain", label: "Non-IT / Operations / Banking / Sales / Other domain" },
  { value: "project", label: "Project Management / Consulting" },
  { value: "student", label: "Student / Fresher / Career break" },
  { value: "other", label: "Other / Not sure" },
];
const EDUCATION: Opt<Education>[] = [
  { value: "secondary", label: "School / Diploma / Associate degree" },
  { value: "bachelor", label: "Bachelor's degree or higher" },
  { value: "gac", label: "Degree from PMI GAC-accredited program" },
  { value: "other", label: "Other / Not sure" },
];
const INTERESTS: Opt<Interest>[] = [
  { value: "unsure", label: "Not sure yet" },
  { value: "general", label: "Business Analysis" },
  { value: "agile", label: "Agile / Product" },
  { value: "data", label: "Data Analytics" },
  { value: "cyber", label: "Cybersecurity" },
  { value: "project", label: "Projects / PMI-PBA" },
];
const BA_YEARS: Opt<number>[] = [
  { value: 0, label: "I haven't done them yet" },
  { value: 0.5, label: "Less than 1 year" },
  { value: 1.5, label: "1–2 years" },
  { value: 3.5, label: "3–4 years" },
  { value: 6, label: "5–7 years" },
  { value: 9, label: "8–10 years" },
  { value: 11, label: "More than 10 years" },
];
const BA_SHARE: Opt<number>[] = [
  { value: 0.2, label: "Occasionally (under 25%)" },
  { value: 0.4, label: "Part of my role (25–50%)" },
  { value: 0.7, label: "Most of my role (50–80%)" },
  { value: 0.9, label: "Almost all my role (over 80%)" },
];
const CONTINUITY: Opt<Continuity>[] = [
  { value: "continuous", label: "Continuous, without significant breaks" },
  { value: "breaks", label: "With one or more breaks" },
  { value: "parttime", label: "Part-time, freelance or varying hours" },
];
const RECENCY: Opt<Recency>[] = [
  { value: "current", label: "I still do them" },
  { value: "lt2", label: "Within the last 2 years" },
  { value: "2to7", label: "2–7 years ago" },
  { value: "7to10", label: "7–10 years ago" },
  { value: "over10", label: "More than 10 years ago" },
  { value: "never", label: "I haven't done these activities" },
];

let idSeq = 0;

/** Text value of a <select> → typed value, "" → null. Numbers are parsed. */
function parseOpt<T extends string | number>(opts: Opt<T>[], raw: string): T | null {
  return opts.find((o) => String(o.value) === raw)?.value ?? null;
}

interface SelectProps<T extends string | number> {
  id: string;
  label: string;
  opts: Opt<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
}

function Select<T extends string | number>({ id, label, opts, value, onChange, placeholder, hint, error }: SelectProps<T>) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="tc-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(parseOpt(opts, e.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opts.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<FinderAnswers>({
    totalYears: null,
    background: null,
    education: "bachelor",
    interest: "unsure",
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
              label="Total professional work experience"
              opts={TOTAL_YEARS}
              value={answers.totalYears}
              onChange={(v) => set("totalYears", v)}
              placeholder="Select your experience"
              error={errFor("totalYears")}
            />
            <Select
              id={`${uid}-background`}
              label="Which best describes your background?"
              opts={BACKGROUNDS}
              value={answers.background}
              onChange={(v) => set("background", v)}
              placeholder="Select your background"
              error={errFor("background")}
            />
            <Select
              id={`${uid}-education`}
              label="Highest completed education"
              opts={EDUCATION}
              value={answers.education}
              onChange={(v) => set("education", v ?? "other")}
            />
            <Select
              id={`${uid}-interest`}
              label="What interests you most?"
              opts={INTERESTS}
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
            2. Tell us about your work experience and knowlege for testing
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
              label="About how many years have you done these types of activities?"
              opts={BA_YEARS}
              value={answers.baYears}
              onChange={(v) => set("baYears", v)}
              placeholder="Select an estimate"
              hint="This is for guidance only; formal applications use documented hours and dates."
            />
            <Select
              id={`${uid}-baShare`}
              label="About how much of your working time involved these activities?"
              opts={BA_SHARE}
              value={answers.baShare}
              onChange={(v) => set("baShare", v)}
              placeholder="Select an estimate"
              hint="We use this to estimate relevant experience, not to automatically credit certification hours."
            />
            <Select
              id={`${uid}-continuity`}
              label="Was this work continuous, or did you have career breaks?"
              opts={CONTINUITY}
              value={answers.continuity}
              onChange={(v) => set("continuity", v)}
              placeholder="Please select"
              hint="Career breaks do not disqualify you. We only count relevant work done within the required period."
            />
            <Select
              id={`${uid}-recent`}
              label="When did you last do these activities?"
              opts={RECENCY}
              value={answers.recent}
              onChange={(v) => set("recent", v)}
              placeholder="Please select"
              hint="Recent experience matters for CCBA (7 years), CBAP (10 years), and PMI-PBA (8 years)."
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
