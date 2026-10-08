import {
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  startOfISOWeek,
} from "date-fns";

export type WeekGroup<T> = {
  key: string;
  week: number | null;
  start: Date | null;
  end: Date | null;
  items: T[];
};

/**
 * Groups items into ISO weeks by a date, newest week first. Items without a
 * date (archived before the date was recorded) come last in their own group.
 */
export function groupByWeek<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
): WeekGroup<T>[] {
  const groups = new Map<string, WeekGroup<T>>();

  for (const item of items) {
    const raw = getDate(item);
    const date = raw ? new Date(raw) : null;
    const valid = date && !Number.isNaN(date.getTime()) ? date : null;
    const key = valid
      ? `${getISOWeekYear(valid)}-${String(getISOWeek(valid)).padStart(2, "0")}`
      : "undated";

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        week: valid ? getISOWeek(valid) : null,
        start: valid ? startOfISOWeek(valid) : null,
        end: valid ? endOfISOWeek(valid) : null,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === "undated") return 1;
    if (b.key === "undated") return -1;
    return b.key.localeCompare(a.key);
  });
}
