import { describe, expect, it } from "vitest";
import { goalScore } from "../../../apps/api/src/sprint/goal-score";

describe("sprint goal score", () => {
  it("counts full, half and missed goals", () => {
    expect(
      goalScore([
        { points: 5, result: "fully" },
        { points: 3, result: "half" },
        { points: 2, result: "none" },
      ]),
    ).toEqual({ earned: 6.5, total: 10 });
  });

  it("is empty without goals", () => {
    expect(goalScore([])).toEqual({ earned: 0, total: 0 });
  });
});
