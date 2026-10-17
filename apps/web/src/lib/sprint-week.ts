import {
  addWeeks,
  getISOWeek,
  getISOWeekYear,
  setISOWeek,
  setISOWeekYear,
} from "date-fns";

type Week = { weekYear: number; week: number };

/**
 * The week the open sprint covers: the calendar week, unless the last sprint
 * already closed that week (closing early, say on a Saturday), in which case
 * it is the week after the last sprint. Mirrors the API's openSprintWeek.
 */
export function openSprintWeek(now: Date, lastClosed?: Week | null): Week {
  const current = { weekYear: getISOWeekYear(now), week: getISOWeek(now) };
  if (!lastClosed) return current;
  const isAhead =
    lastClosed.weekYear > current.weekYear ||
    (lastClosed.weekYear === current.weekYear &&
      lastClosed.week >= current.week);
  if (!isAhead) return current;
  const next = addWeeks(
    setISOWeek(setISOWeekYear(now, lastClosed.weekYear), lastClosed.week),
    1,
  );
  return { weekYear: getISOWeekYear(next), week: getISOWeek(next) };
}
