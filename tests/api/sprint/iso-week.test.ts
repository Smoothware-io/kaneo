import { describe, expect, it } from "vitest";
import {
  openSprintWeek,
  weekAfter,
} from "../../../apps/api/src/sprint/iso-week";

describe("open sprint week", () => {
  const saturday = new Date("2026-10-17T13:35:00Z"); // ISO week 42

  it("is the calendar week when the last sprint closed earlier", () => {
    expect(openSprintWeek(saturday, { weekYear: 2026, week: 41 })).toEqual({
      weekYear: 2026,
      week: 42,
    });
    expect(openSprintWeek(saturday, null)).toEqual({
      weekYear: 2026,
      week: 42,
    });
  });

  it("moves to next week once this week's sprint is closed", () => {
    expect(openSprintWeek(saturday, { weekYear: 2026, week: 42 })).toEqual({
      weekYear: 2026,
      week: 43,
    });
  });

  it("rolls over the year", () => {
    expect(weekAfter({ weekYear: 2026, week: 53 })).toEqual({
      weekYear: 2027,
      week: 1,
    });
    expect(weekAfter({ weekYear: 2025, week: 52 })).toEqual({
      weekYear: 2026,
      week: 1,
    });
  });
});
