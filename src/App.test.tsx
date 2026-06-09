import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./lib/storage";

const storedState = {
  records: [
    { id: "jun", startDate: "2026-06-09", endDate: "2026-06-14", note: "" }
  ],
  dayNotes: {
    "2026-06-10": "测试备注"
  },
  settings: {
    cycleLength: 30,
    darkMode: false
  }
};

describe("App", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
    vi.setSystemTime(new Date(2026, 5, 9, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders only current month dates in the calendar", () => {
    render(<App />);
    const calendar = screen.getByLabelText("月历");
    expect(within(calendar).getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(within(calendar).getByRole("button", { name: "30" })).toBeInTheDocument();
    expect(within(calendar).queryByRole("button", { name: "31" })).not.toBeInTheDocument();
  });

  it("creates a period record by clicking two dates", async () => {
    const user = userEvent.setup();
    render(<App />);

    const calendar = screen.getByLabelText("月历");
    await user.click(within(calendar).getByRole("button", { name: "16" }));
    await user.click(within(calendar).getByRole("button", { name: "18" }));

    expect(screen.getByText("已更新本月经期记录")).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toContain("2026-06-16");
  });

  it("opens settings and version surfaces", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByLabelText("设置"));
    expect(screen.getByRole("dialog", { name: "设置" })).toBeInTheDocument();

    await user.click(screen.getByLabelText("关闭设置"));
    await user.click(screen.getByLabelText("版本更新"));
    expect(screen.getByText("当前版本 v2.0")).toBeInTheDocument();
  });
});
