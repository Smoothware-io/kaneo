/** ISO 8601 week and week-year (weeks start Monday; week 1 holds Jan 4), in UTC. */
export function isoWeek(date: Date) {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // Move to the Thursday of this week; its year is the ISO week-year.
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const weekYear = day.getUTCFullYear();
  const yearStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return { weekYear, week };
}

type Week = { weekYear: number; week: number };

/** The ISO week right after the given one. */
export function weekAfter({ weekYear, week }: Week): Week {
  // Thursday of week 1 is the Thursday of the week holding Jan 4.
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const thursday = jan4.getTime() + (4 - (jan4.getUTCDay() || 7)) * 86_400_000;
  return isoWeek(new Date(thursday + week * 7 * 86_400_000));
}

/**
 * The week the open sprint covers: the calendar week, unless the last sprint
 * already closed that week (closing early, say on a Saturday), in which case
 * it is the week after the last sprint.
 */
export function openSprintWeek(now: Date, lastClosed?: Week | null): Week {
  const current = isoWeek(now);
  if (!lastClosed) return current;
  const isAhead =
    lastClosed.weekYear > current.weekYear ||
    (lastClosed.weekYear === current.weekYear &&
      lastClosed.week >= current.week);
  return isAhead ? weekAfter(lastClosed) : current;
}
