import { describe, expect, it } from "vitest";
import type { PeriodRecord } from "../types";
import {
  calculateAverageCycle,
  getPrediction,
  getPredictionSeriesForRange,
  replaceRecordsInSameMonths
} from "./period";

const records: PeriodRecord[] = [
  { id: "apr", startDate: "2026-04-10", endDate: "2026-04-15", note: "" },
  { id: "may", startDate: "2026-05-10", endDate: "2026-05-15", note: "" },
  { id: "jun", startDate: "2026-06-09", endDate: "2026-06-14", note: "" }
];

describe("period calculations", () => {
  it("calculates average cycle length", () => {
    expect(calculateAverageCycle(records)).toBe(30);
  });

  it("predicts next period, ovulation, and fertile dates", () => {
    const prediction = getPrediction(records, 30);
    expect(prediction.nextPeriodStart).toBe("2026-07-09");
    expect(prediction.ovulationDate).toBe("2026-06-25");
    expect(prediction.fertileDates.has("2026-06-20")).toBe(true);
  });

  it("generates future period dates for the visible month", () => {
    const series = getPredictionSeriesForRange(records, 30, new Date(2026, 6, 1), new Date(2026, 6, 31));
    expect(series.predictedPeriodDates.has("2026-07-09")).toBe(true);
    expect(series.predictedPeriodDates.has("2026-07-14")).toBe(true);
  });

  it("replaces only records in the same touched months", () => {
    const updated = replaceRecordsInSameMonths(records, {
      id: "jul",
      startDate: "2026-07-08",
      endDate: "2026-07-13",
      note: ""
    });
    expect(updated).toHaveLength(4);

    const replaced = replaceRecordsInSameMonths(updated, {
      id: "jul2",
      startDate: "2026-07-10",
      endDate: "2026-07-15",
      note: ""
    });
    expect(replaced).toHaveLength(4);
    expect(replaced.some((record) => record.id === "jul")).toBe(false);
    expect(replaced.some((record) => record.id === "jun")).toBe(true);
  });
});
