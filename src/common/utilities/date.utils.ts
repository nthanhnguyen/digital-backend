// Vietnam timezone constant
export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function isValidDate(date: unknown): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(dateString: string): Date | null {
  const date = new Date(dateString);
  return isValidDate(date) ? date : null;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function diffInDays(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function toAirwallexDate(date: string): string {
  const d = new Date(date);
  return d.toISOString().replace('.000Z', '+0000');
}

/**
 * Get current date string in Vietnam timezone (YYYY-MM-DD format)
 */
export function getTodayVN(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: VN_TIMEZONE });
}

/**
 * Get current Date object representing start of day in Vietnam timezone
 */
export function getTodayStartVN(): Date {
  const todayStr = getTodayVN();
  return parseDateVN(todayStr);
}

/**
 * Parse a date string (YYYY-MM-DD) as Vietnam timezone
 * Returns a Date object representing midnight VN time
 */
export function parseDateVN(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00+07:00');
}

/**
 * Check if a date string (YYYY-MM-DD) is in the future compared to today in Vietnam timezone
 */
export function isDateInFutureVN(dateStr: string): boolean {
  const todayVN = getTodayVN();
  return dateStr > todayVN;
}

/**
 * Check if a date string (YYYY-MM-DD) is today or in the past in Vietnam timezone
 */
export function isDateTodayOrPastVN(dateStr: string): boolean {
  const todayVN = getTodayVN();
  return dateStr <= todayVN;
}

/**
 * Format a Date object to YYYY-MM-DD string in Vietnam timezone
 */
export function formatDateVN(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: VN_TIMEZONE });
}
