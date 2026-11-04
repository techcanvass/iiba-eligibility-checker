import type { JobEntry, PdEntry } from "./types";
import {
  daysInclusive,
  maxDate,
  minDate,
  parseISODate,
  subtractYears,
  addDays,
} from "./dates";

const DAYS_PER_WEEK = 7;

/** BA hours a single job contributes inside [windowStart, asOf]. */
export function jobHoursInWindow(job: JobEntry, windowStart: Date, asOf: Date): number {
  const start = parseISODate(job.start);
  const end = job.end ? parseISODate(job.end) : asOf;
  const from = maxDate(start, windowStart);
  const to = minDate(end, asOf);
  const days = daysInclusive(from, to);
  if (days === 0) return 0;
  const weeks = days / DAYS_PER_WEEK;
  return weeks * job.hoursPerWeek * (job.baPercent / 100);
}

/** Total BA hours across all jobs inside the `windowYears` before `asOf`. Rounded down. */
export function baHoursInWindow(jobs: JobEntry[], asOf: Date, windowYears: number): number {
  if (windowYears <= 0) return 0;
  const windowStart = addDays(subtractYears(asOf, windowYears), 1);
  const total = jobs.reduce((sum, j) => sum + jobHoursInWindow(j, windowStart, asOf), 0);
  return Math.floor(total);
}

/** Current weekly BA hours from jobs that are still active on `asOf`. */
export function currentWeeklyBaHours(jobs: JobEntry[], asOf: Date): number {
  return jobs
    .filter((j) => parseISODate(j.start) <= asOf && (!j.end || parseISODate(j.end) >= asOf))
    .reduce((sum, j) => sum + j.hoursPerWeek * (j.baPercent / 100), 0);
}

/** PD hours that count: within `windowYears` of `asOf` and not an excluded type. */
export function countablePdHours(
  entries: PdEntry[],
  asOf: Date,
  windowYears: number,
  excludedTypes: readonly string[],
): number {
  const windowStart = addDays(subtractYears(asOf, windowYears), 1);
  return entries
    .filter((e) => !excludedTypes.includes(e.type))
    .filter((e) => {
      const d = parseISODate(e.completedOn);
      return d >= windowStart && d <= asOf;
    })
    .reduce((sum, e) => sum + e.hours, 0);
}

/**
 * Find the first date on which BA hours in the rolling window reach `target`,
 * assuming current jobs continue unchanged. Searches week by week up to `maxYears`.
 * Returns null if not reachable (e.g. no current BA work).
 */
export function projectEligibilityDate(
  jobs: JobEntry[],
  asOf: Date,
  windowYears: number,
  target: number,
  maxYears = 15,
): Date | null {
  if (baHoursInWindow(jobs, asOf, windowYears) >= target) return asOf;
  if (currentWeeklyBaHours(jobs, asOf) <= 0) return null;

  // Ongoing jobs keep accruing; ended jobs fall out of the window over time.
  for (let week = 1; week <= maxYears * 52; week++) {
    const future = addDays(asOf, week * DAYS_PER_WEEK);
    if (baHoursInWindow(jobs, future, windowYears) >= target) return future;
  }
  return null;
}
