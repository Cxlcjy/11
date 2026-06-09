import type { PeriodRecord, Prediction, PredictionSeries } from "../types";
import {
  addDays,
  addMonths,
  clampNumber,
  dateOnly,
  daysBetween,
  formatDate,
  getMonthsBetween,
  startOfDay
} from "./date";

export function sortRecords(records: PeriodRecord[]): PeriodRecord[] {
  return [...records].sort((a, b) => dateOnly(a.startDate).getTime() - dateOnly(b.startDate).getTime());
}

export function isValidRecord(record: unknown): record is PeriodRecord {
  if (!record || typeof record !== "object") return false;
  const item = record as Partial<PeriodRecord>;
  if (!item.startDate || !item.endDate) return false;

  const start = dateOnly(item.startDate);
  const end = dateOnly(item.endDate);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end >= start;
}

export function normalizeRecord(record: Partial<PeriodRecord>): PeriodRecord {
  return {
    id: String(record.id || cryptoRandomId()),
    startDate: formatDate(dateOnly(record.startDate || formatDate(new Date()))),
    endDate: formatDate(dateOnly(record.endDate || record.startDate || formatDate(new Date()))),
    note: String(record.note || "").slice(0, 160)
  };
}

export function normalizeDayNotes(dayNotes: unknown): Record<string, string> {
  if (!dayNotes || typeof dayNotes !== "object" || Array.isArray(dayNotes)) return {};

  return Object.entries(dayNotes).reduce<Record<string, string>>((notes, [dateKey, note]) => {
    const cleanDate = formatDate(dateOnly(dateKey));
    const cleanNote = String(note || "").trim().slice(0, 160);
    if (!Number.isNaN(dateOnly(cleanDate).getTime()) && cleanNote) notes[cleanDate] = cleanNote;
    return notes;
  }, {});
}

export function calculateAverageCycle(records: PeriodRecord[]): number | null {
  if (records.length < 2) return null;

  const starts = records.map((record) => dateOnly(record.startDate)).sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let index = 1; index < starts.length; index += 1) {
    const interval = daysBetween(starts[index - 1], starts[index]);
    if (interval >= 15 && interval <= 60) intervals.push(interval);
  }

  if (!intervals.length) return null;
  return Math.round(intervals.reduce((sum, item) => sum + item, 0) / intervals.length);
}

export function calculateAveragePeriodLength(records: PeriodRecord[]): number {
  if (!records.length) return 5;

  const durations = records
    .map((record) => daysBetween(record.startDate, record.endDate) + 1)
    .filter((duration) => duration >= 1 && duration <= 14);

  if (!durations.length) return 5;
  return clampNumber(Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length), 1, 14, 5);
}

export function getPrediction(records: PeriodRecord[], cycleLength: number): Prediction {
  const lastRecord = [...records].sort((a, b) => dateOnly(b.startDate).getTime() - dateOnly(a.startDate).getTime())[0];
  const emptyPrediction = {
    nextPeriodStart: "",
    ovulationDate: "",
    fertileStart: "",
    fertileEnd: "",
    fertileDates: new Set<string>()
  };

  if (!lastRecord) return emptyPrediction;

  const resolvedCycle = cycleLength || calculateAverageCycle(records) || 28;
  const nextPeriod = addDays(dateOnly(lastRecord.startDate), resolvedCycle);
  const ovulation = addDays(nextPeriod, -14);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);
  const fertileDates = new Set<string>();

  for (let day = new Date(fertileStart); day <= fertileEnd; day = addDays(day, 1)) {
    fertileDates.add(formatDate(day));
  }

  return {
    nextPeriodStart: formatDate(nextPeriod),
    ovulationDate: formatDate(ovulation),
    fertileStart: formatDate(fertileStart),
    fertileEnd: formatDate(fertileEnd),
    fertileDates
  };
}

export function getPredictionSeriesForRange(
  records: PeriodRecord[],
  cycleLength: number,
  rangeStart: Date,
  rangeEnd: Date
): PredictionSeries {
  const series = emptyPredictionSeries();
  const lastRecord = [...records].sort((a, b) => dateOnly(b.startDate).getTime() - dateOnly(a.startDate).getTime())[0];
  if (!lastRecord) return series;

  const resolvedCycle = cycleLength || calculateAverageCycle(records) || 28;
  const periodLength = calculateAveragePeriodLength(records);
  const visibleStart = dateOnly(rangeStart);
  const visibleEnd = dateOnly(rangeEnd);

  records.forEach((record) => {
    const nextPeriod = addDays(dateOnly(record.startDate), resolvedCycle);
    const ovulation = addDays(nextPeriod, -14);
    const fertileStart = addDays(ovulation, -5);
    const fertileEnd = addDays(ovulation, 1);

    series.ovulationDates.add(formatDate(ovulation));
    for (let day = new Date(fertileStart); day <= fertileEnd; day = addDays(day, 1)) {
      series.fertileDates.add(formatDate(day));
    }
  });

  let periodStart = addDays(dateOnly(lastRecord.startDate), resolvedCycle);
  while (periodStart < addDays(visibleStart, -periodLength - resolvedCycle)) {
    periodStart = addDays(periodStart, resolvedCycle);
  }

  while (periodStart <= addDays(visibleEnd, periodLength)) {
    series.nextPeriodStarts.add(formatDate(periodStart));
    for (let day = new Date(periodStart); day < addDays(periodStart, periodLength); day = addDays(day, 1)) {
      series.predictedPeriodDates.add(formatDate(day));
    }
    periodStart = addDays(periodStart, resolvedCycle);
  }

  return series;
}

export function buildPeriodDateSet(records: PeriodRecord[]): Set<string> {
  const dates = new Set<string>();

  records.forEach((record) => {
    for (let day = dateOnly(record.startDate); day <= dateOnly(record.endDate); day = addDays(day, 1)) {
      dates.add(formatDate(day));
    }
  });

  return dates;
}

export function replaceRecordsInSameMonths(records: PeriodRecord[], newRecord: PeriodRecord): PeriodRecord[] {
  const months = getMonthsBetween(newRecord.startDate, newRecord.endDate);
  const preservedRecords = records.filter((record) => !recordTouchesMonths(record, months));
  return sortRecords([...preservedRecords, newRecord]);
}

export function recordTouchesMonths(record: PeriodRecord, monthSet: Set<string>): boolean {
  return [...getMonthsBetween(record.startDate, record.endDate)].some((monthKey) => monthSet.has(monthKey));
}

export function findRecordByDate(records: PeriodRecord[], dateKey: string): PeriodRecord | undefined {
  const selected = dateOnly(dateKey);
  return records.find((record) => selected >= dateOnly(record.startDate) && selected <= dateOnly(record.endDate));
}

export function recentRecords(records: PeriodRecord[], today = new Date()): PeriodRecord[] {
  const sixMonthsAgo = addMonths(startOfDay(today), -6);
  return records
    .filter((record) => dateOnly(record.startDate) >= sixMonthsAgo)
    .sort((a, b) => dateOnly(b.startDate).getTime() - dateOnly(a.startDate).getTime());
}

export function cryptoRandomId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyPredictionSeries(): PredictionSeries {
  return {
    nextPeriodStarts: new Set<string>(),
    predictedPeriodDates: new Set<string>(),
    ovulationDates: new Set<string>(),
    fertileDates: new Set<string>()
  };
}
