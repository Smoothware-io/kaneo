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
