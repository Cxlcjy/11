export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function dateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: string | Date, days: number): Date {
  const next = dateOnly(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function daysBetween(start: string | Date, end: string | Date): number {
  return Math.round((dateOnly(end).getTime() - dateOnly(start).getTime()) / MS_PER_DAY);
}

export function formatDate(date: string | Date): string {
  const cleanDate = dateOnly(date);
  const year = cleanDate.getFullYear();
  const month = String(cleanDate.getMonth() + 1).padStart(2, "0");
  const day = String(cleanDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(date: string | Date): string {
  const cleanDate = dateOnly(date);
  return `${cleanDate.getMonth() + 1}月${cleanDate.getDate()}日`;
}

export function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getMonthsBetween(startDate: string, endDate: string): Set<string> {
  const months = new Set<string>();
  const end = dateOnly(endDate);

  for (
    let cursor = startOfMonth(dateOnly(startDate));
    cursor <= end;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  ) {
    months.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
  }

  return months;
}
