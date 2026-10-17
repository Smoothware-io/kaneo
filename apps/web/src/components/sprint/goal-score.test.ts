import { describe, expect, it } from "vitest";
import { formatPoints, goalScore, suggestedResult } from "./goal-score";

describe("suggestedResult", () => {
  it("follows the linked tickets", () => {
    expect(suggestedResult({ taskCount: 3, doneTaskCount: 3 })).toBe("fully");
    expect(suggestedResult({ taskCount: 3, doneTaskCount: 1 })).toBe("half");
    expect(suggestedResult({ taskCount: 3, doneTaskCount: 0 })).toBe("none");
  });

  it("makes no suggestion without tickets", () => {
    expect(suggestedResult({ taskCount: 0, doneTaskCount: 0 })).toBeNull();
  });
});

describe("goalScore", () => {
  it("counts half results as half and leaves unscored goals out", () => {
    expect(
      goalScore([
        { points: 5, result: "fully" },
        { points: 3, result: "half" },
        { points: 2, result: null },
      ]),
    ).toEqual({ earned: 6.5, total: 10, percent: 65 });
    expect(formatPoints(6.5)).toBe("6.5");
    expect(formatPoints(7)).toBe("7");
  });
});
