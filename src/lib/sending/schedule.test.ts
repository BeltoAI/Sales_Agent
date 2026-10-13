import { describe, expect, it } from "vitest";
import { addBusinessDays, followUpSlot, isBusinessHours, nextBusinessSlot, outOfOfficeResumeAt, safeTimezone, startOfLocalDay, zonedParts, zonedTimeToUtc } from "./schedule";

const NY = "America/New_York";
const BERLIN = "Europe/Berlin";

describe("timezone math", () => {
  it("converts local wall-clock time to UTC, including DST", () => {
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, NY).toISOString()).toBe("2026-01-15T14:00:00.000Z"); // EST
    expect(zonedTimeToUtc(2026, 7, 15, 9, 0, NY).toISOString()).toBe("2026-07-15T13:00:00.000Z"); // EDT
    expect(zonedTimeToUtc(2026, 3, 30, 9, 0, BERLIN).toISOString()).toBe("2026-03-30T07:00:00.000Z"); // CEST
  });
  it("reads local parts and weekday", () => {
    const p = zonedParts(new Date("2026-10-16T22:30:00Z"), "Asia/Tokyo"); // Sat 07:30 in Tokyo
    expect(p).toMatchObject({ year: 2026, month: 10, day: 17, hour: 7, minute: 30, weekday: 6 });
  });
  it("falls back to UTC for invalid timezones", () => {
    expect(safeTimezone("Not/AZone")).toBe("UTC");
    expect(safeTimezone(null, BERLIN)).toBe(BERLIN);
  });
  it("finds the start of the local day", () => {
    expect(startOfLocalDay(new Date("2026-10-14T03:00:00Z"), NY).toISOString()).toBe("2026-10-13T04:00:00.000Z");
  });
});

describe("business hours (Mon–Fri 09:00–17:00 recipient time)", () => {
  it("is inside on a weekday at 10:00 local", () => {
    expect(isBusinessHours(zonedTimeToUtc(2026, 10, 14, 10, 0, NY), NY)).toBe(true);
  });
  it("is outside before 9, at/after 17, and on weekends", () => {
    expect(isBusinessHours(zonedTimeToUtc(2026, 10, 14, 8, 59, NY), NY)).toBe(false);
    expect(isBusinessHours(zonedTimeToUtc(2026, 10, 14, 17, 0, NY), NY)).toBe(false);
    expect(isBusinessHours(zonedTimeToUtc(2026, 10, 17, 11, 0, NY), NY)).toBe(false); // Saturday
    expect(isBusinessHours(zonedTimeToUtc(2026, 10, 18, 11, 0, NY), NY)).toBe(false); // Sunday
  });
  it("depends on the recipient's timezone, not the server's", () => {
    const t = new Date("2026-10-14T15:00:00Z"); // 11:00 New York, 17:00 Berlin
    expect(isBusinessHours(t, NY)).toBe(true);
    expect(isBusinessHours(t, BERLIN)).toBe(false);
  });
});

describe("nextBusinessSlot (random spread)", () => {
  it("always lands inside business hours, for many random draws and start times", () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {
      const after = new Date(Date.UTC(2026, 9, 1) + i * 3_917_000); // walk through ~3 weeks
      for (const tz of [NY, BERLIN, "Asia/Kolkata", "Australia/Sydney"]) {
        const slot = nextBusinessSlot(after, tz, rand);
        expect(isBusinessHours(slot, tz)).toBe(true);
        expect(slot.getTime()).toBeGreaterThan(after.getTime());
      }
    }
  });
  it("Friday evening → Monday", () => {
    const friEvening = zonedTimeToUtc(2026, 10, 16, 18, 0, NY);
    expect(zonedParts(nextBusinessSlot(friEvening, NY, () => 0), NY)).toMatchObject({ weekday: 1, hour: 9 });
  });
  it("uses the rest of today when there is time left", () => {
    const tueNoon = zonedTimeToUtc(2026, 10, 13, 12, 0, NY);
    const slot = nextBusinessSlot(tueNoon, NY, () => 0.5);
    expect(zonedParts(slot, NY)).toMatchObject({ day: 13 });
  });
  it("spreads sends across the window", () => {
    const morning = zonedTimeToUtc(2026, 10, 13, 6, 0, NY);
    const early = zonedParts(nextBusinessSlot(morning, NY, () => 0.01), NY).hour;
    const late = zonedParts(nextBusinessSlot(morning, NY, () => 0.99), NY).hour;
    expect(early).toBe(9);
    expect(late).toBe(16);
  });
});

describe("minimum 3 business days between steps", () => {
  it("skips weekends", () => {
    const fri = zonedTimeToUtc(2026, 10, 16, 10, 0, NY);
    expect(zonedParts(addBusinessDays(fri, 3, NY), NY)).toMatchObject({ day: 21, weekday: 3, hour: 10 }); // Wed
    const mon = zonedTimeToUtc(2026, 10, 12, 10, 0, NY);
    expect(zonedParts(addBusinessDays(mon, 3, NY), NY)).toMatchObject({ day: 15, weekday: 4 }); // Thu
  });
  it("follow-up slot is never earlier than 3 business days after the previous send", () => {
    for (let i = 0; i < 200; i++) {
      const sent = new Date(Date.UTC(2026, 9, 5) + i * 5_400_000);
      const slot = followUpSlot(sent, sent, NY, Math.random);
      expect(slot.getTime()).toBeGreaterThanOrEqual(addBusinessDays(sent, 3, NY).getTime());
      expect(isBusinessHours(slot, NY)).toBe(true);
    }
  });
});

describe("out-of-office resume", () => {
  const received = zonedTimeToUtc(2026, 10, 13, 10, 0, NY); // Tue
  it("resumes on the next business day after the stated return date", () => {
    const at = outOfOfficeResumeAt("2026-10-23", received, NY); // back Fri 23rd → resume Mon 26th
    expect(zonedParts(at, NY)).toMatchObject({ day: 26, weekday: 1 });
    expect(isBusinessHours(at, NY)).toBe(true);
  });
  it("defaults to 7 business days when no date is given", () => {
    const at = outOfOfficeResumeAt(null, received, NY);
    expect(at.getTime()).toBeGreaterThanOrEqual(addBusinessDays(received, 7, NY).getTime());
    expect(isBusinessHours(at, NY)).toBe(true);
  });
  it("treats past dates as back now, and caps far-future dates", () => {
    expect(outOfOfficeResumeAt("2020-01-01", received, NY).getTime()).toBeGreaterThan(received.getTime());
    expect(outOfOfficeResumeAt("2030-01-01", received, NY).getTime()).toBeLessThan(received.getTime() + 65 * 86_400_000) // 60 days, then the next business slot;
  });
});
