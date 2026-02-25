import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAccountDue } from "../src/schedule.js";

describe("isAccountDue", () => {
  beforeEach(() => {
    // Fix time to 2026-02-26 10:30:00 UTC (a mid-morning time that avoids edge cases)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T10:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when never checked", () => {
    expect(isAccountDue("0 */1 * * *", null)).toBe(true);
  });

  it("returns true when last check is before previous cron occurrence", () => {
    // Cron: every hour. At 10:30, prev occurrence is 10:00.
    // Last checked at 08:30 (2 hours ago) — before 10:00, so due.
    const twoHoursAgo = new Date("2026-02-26T08:30:00Z").toISOString();
    expect(isAccountDue("0 */1 * * *", twoHoursAgo)).toBe(true);
  });

  it("returns false when last check is after previous cron occurrence", () => {
    // Cron: every 2 hours (0,2,4,6,8,10,...). At 10:30, prev occurrence is 10:00.
    // Last checked at 10:15 (15 min ago) — after 10:00, so not due.
    const fifteenMinAgo = new Date("2026-02-26T10:15:00Z").toISOString();
    expect(isAccountDue("0 */2 * * *", fifteenMinAgo)).toBe(false);
  });

  it("handles daily schedules", () => {
    // Cron: 9am and 6pm. At 10:30, prev occurrence is 09:00 today.
    // Last checked yesterday — before 09:00 today, so due.
    const yesterday = new Date("2026-02-25T10:30:00Z").toISOString();
    expect(isAccountDue("0 9,18 * * *", yesterday)).toBe(true);
  });
});
