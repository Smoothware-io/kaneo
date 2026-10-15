import type { SprintGoalResult } from "../database/schema";

const RESULT_SHARE: Record<SprintGoalResult, number> = {
  fully: 1,
  half: 0.5,
  none: 0,
};

/** Points earned and possible for a set of scored goals. */
export function goalScore(
  goals: { points: number; result: SprintGoalResult }[],
) {
  let earned = 0;
  let total = 0;
  for (const goal of goals) {
    earned += goal.points * RESULT_SHARE[goal.result];
    total += goal.points;
  }
  return { earned, total };
}
