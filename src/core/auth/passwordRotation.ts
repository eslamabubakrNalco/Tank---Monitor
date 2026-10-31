/**
 * WaterWise Deterministic 3-Day Password Rotation Engine
 * Extracted verbatim from Eslam Abubakr's original WaterWise Calculator.
 * Works 100% offline with zero network calls.
 */

export const MASTER_SECRET = 'WW2025';
export const ADMIN_BYPASS_CODE = 'WW2025-ADMIN';
export const ROTATION_EPOCH_UTC = Date.UTC(2025, 0, 1); // Jan 1, 2025 00:00:00 UTC
export const THREE_DAYS_MS = 3 * 86400000;

export const WORD_BANK = [
  'WATER',
  'DOSE',
  'PUMP',
  'FLOW',
  'NALCO',
  'CHEM',
  'SAFE',
  'TREAT',
  'KAFD',
  'ESLAM',
] as const;

export interface PasswordScheduleEntry {
  periodIndex: number;
  password: string;
  startDateISO: string;
  endDateISO: string;
  isCurrent: boolean;
}

/**
 * Original deterministic bitwise string hash function (`hashStr`)
 */
export function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Computes the 3-day period index for a given timestamp (ms)
 */
export function getPeriodIndex(timestampMs: number = Date.now()): number {
  return Math.floor((timestampMs - ROTATION_EPOCH_UTC) / THREE_DAYS_MS);
}

/**
 * Generates the deterministic password (`WORD-XXXX`) for a given 3-day period index
 */
export function generatePasswordForPeriod(periodIndex: number): string {
  const hash = hashStr(`${MASTER_SECRET}${periodIndex}`);
  const word = WORD_BANK[hash % WORD_BANK.length];
  const digits = String(hash % 10000).padStart(4, '0');
  return `${word}-${digits}`;
}

/**
 * Validates user input against the current 3-day rotating password or admin bypass code
 */
export function verifyAccessPassword(
  input: string,
  timestampMs: number = Date.now()
): { valid: boolean; isAdmin: boolean; currentPassword: string } {
  const normalized = input.trim().toUpperCase();
  const currentPeriod = getPeriodIndex(timestampMs);
  const currentPassword = generatePasswordForPeriod(currentPeriod);

  if (normalized === ADMIN_BYPASS_CODE) {
    return { valid: true, isAdmin: true, currentPassword };
  }

  if (normalized === currentPassword) {
    return { valid: true, isAdmin: false, currentPassword };
  }

  return { valid: false, isAdmin: false, currentPassword };
}

/**
 * Generates the Admin Password Schedule table around the current date
 */
export function getPasswordSchedule(
  timestampMs: number = Date.now(),
  pastPeriods: number = 2,
  futurePeriods: number = 8
): PasswordScheduleEntry[] {
  const currentPeriod = getPeriodIndex(timestampMs);
  const schedule: PasswordScheduleEntry[] = [];

  for (let offset = -pastPeriods; offset <= futurePeriods; offset++) {
    const p = currentPeriod + offset;
    const startMs = ROTATION_EPOCH_UTC + p * THREE_DAYS_MS;
    const endMs = startMs + THREE_DAYS_MS;
    schedule.push({
      periodIndex: p,
      password: generatePasswordForPeriod(p),
      startDateISO: new Date(startMs).toISOString().slice(0, 10),
      endDateISO: new Date(endMs).toISOString().slice(0, 10),
      isCurrent: offset === 0,
    });
  }

  return schedule;
}
