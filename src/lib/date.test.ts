import { describe, expect, it } from "vitest";
import { addDays, dateOnly, daysBetween, formatDate, formatDisplayDate, getMonthsBetween } from "./date";

describe("date utilities", () => {
  it("formats dates consistently", () => {
    expect(formatDate(new Date(2026, 5, 9))).toBe("2026-06-09");
    expect(formatDisplayDate("2026-06-09")).toBe("6月9日");
  });

  it("calculates date offsets and intervals", () => {
    expect(formatDate(addDays("2026-06-09", 5))).toBe("2026-06-14");
    expect(daysBetween(dateOnly("2026-06-09"), dateOnly("2026-06-14"))).toBe(5);
  });

  it("collects months touched by a range", () => {
    expect([...getMonthsBetween("2026-06-29", "2026-07-03")]).toEqual(["2026-06", "2026-07"]);
  });
});
