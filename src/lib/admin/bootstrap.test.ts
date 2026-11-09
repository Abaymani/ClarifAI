import { describe, expect, test } from "vitest";

import { bootstrapIntervals, quantile } from "@/lib/admin/bootstrap";

const options = { resamples: 2000, seed: 76 };

// The mean of the groups' values, each counted as often as it was drawn.
function mean(values: number[]) {
  return (weights: number[]) => [
    weights.reduce((sum, weight, g) => sum + weight * values[g], 0) /
      weights.reduce((sum, weight) => sum + weight, 0),
  ];
}

describe("quantile", () => {
  test("interpolates between the closest ranks", () => {
    const values = [5, 1, 3, 2, 4];
    expect(quantile(values, 0)).toBe(1);
    expect(quantile(values, 0.5)).toBe(3);
    expect(quantile(values, 0.1)).toBeCloseTo(1.4, 12);
    expect(quantile(values, 1)).toBe(5);
  });
});

describe("bootstrapIntervals", () => {
  test("gives the spread of a statistic over redrawn groups", () => {
    const [interval] = bootstrapIntervals(4, mean([1, 2, 3, 4]), options);
    const [low, high] = interval!;

    expect(low).toBeGreaterThanOrEqual(1);
    expect(low).toBeLessThan(2.5);
    expect(high).toBeGreaterThan(2.5);
    expect(high).toBeLessThanOrEqual(4);
  });

  test("draws the same groups for the same seed", () => {
    const statistic = mean([0.2, 0.9, 0.4, 0.7, 0.1]);
    expect(bootstrapIntervals(5, statistic, options)).toEqual(
      bootstrapIntervals(5, statistic, options),
    );

    const firstDraw = (seed: number) => {
      const draws: number[][] = [];
      bootstrapIntervals(
        5,
        (weights) => {
          draws.push(weights);
          return [0];
        },
        { resamples: 1, seed },
      );
      return draws[0];
    };
    expect(firstDraw(76)).toEqual(firstDraw(76));
    expect(firstDraw(76)).not.toEqual(firstDraw(77));
  });

  test("has no interval for a statistic any draw leaves undefined", () => {
    const intervals = bootstrapIntervals(
      3,
      (weights) => [weights[0] > 0 ? 1 : null, 0.5],
      options,
    );
    expect(intervals).toEqual([null, [0.5, 0.5]]);
  });

  test("has no interval with fewer than two groups to draw from", () => {
    expect(bootstrapIntervals(1, () => [0.8, 0.3], options)).toEqual([
      null,
      null,
    ]);
    expect(bootstrapIntervals(0, () => [null], options)).toEqual([null]);
  });
});
