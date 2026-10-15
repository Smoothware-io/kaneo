type ScoredGoal = { points: number; result: "fully" | "half" | "none" | null };

const RESULT_SHARE = { fully: 1, half: 0.5, none: 0 } as const;

/** Mirrors the API's score: fully counts all points, half counts half. */
export function goalScore(goals: ScoredGoal[]) {
  let earned = 0;
  let total = 0;
  for (const goal of goals) {
    total += goal.points;
    if (goal.result) earned += goal.points * RESULT_SHARE[goal.result];
  }
  return { earned, total, percent: percentOf(earned, total) };
}

export function percentOf(earned: number, total: number) {
  return total > 0 ? Math.round((earned / total) * 100) : 0;
}

// Half results produce .5 scores; anything else stays a whole number.
export function formatPoints(points: number) {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}
