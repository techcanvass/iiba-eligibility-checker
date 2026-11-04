const MS_PER_DAY = 86_400_000;

/** Parse YYYY-MM-DD as a UTC date (avoids timezone drift). Throws on invalid input. */
export function parseISODate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid date "${value}" — expected YYYY-MM-DD`);
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(mo) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    throw new Error(`Invalid calendar date "${value}"`);
  }
  return date;
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Subtract whole years, clamping Feb 29 → Feb 28 where needed. */
export function subtractYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  if (d.getUTCMonth() !== month) d.setUTCDate(0); // rolled into March → last day of Feb
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days between two dates, inclusive of both ends; 0 if b < a. */
export function daysInclusive(a: Date, b: Date): number {
  const diff = Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
  return diff < 0 ? 0 : diff + 1;
}

export function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

export function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}
