import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  criterionIds,
  formatReflectionScore,
  maxReflectionScore,
  momentScore,
  parseReflectionCodingFramework,
  reflectionScore,
  sessionReflectionAverage,
} from "@/lib/admin/reflection-coding";

const framework = parseReflectionCodingFramework(
  JSON.parse(
    readFileSync(
      join(process.cwd(), "framework", "reflection_coding.JSON"),
      "utf8",
    ),
  ),
);

describe("reflection coding framework", () => {
  test("has the researchers' three states with nine criteria", () => {
    expect(framework.states.map((state) => state.state)).toEqual([1, 2, 3]);
    expect(framework.states.map((state) => state.criteria.length)).toEqual([
      3, 2, 4,
    ]);
    expect(maxReflectionScore(framework)).toBe(9);
    expect(criterionIds(framework)).toContain("S3-ACTION-PLAN");
  });

  test("rejects repeated criterion ids", () => {
    expect(() =>
      parseReflectionCodingFramework({
        version: "x",
        states: [
          { state: 1, criteria: [{ id: "A", label: "a" }] },
          { state: 2, criteria: [{ id: "A", label: "b" }] },
        ],
      }),
    ).toThrow(/repeat/);
  });
});

describe("reflection scores", () => {
  test("counts each known criterion once and ignores unknown ones", () => {
    expect(
      reflectionScore(
        ["S1-WENT-WELL", "S1-WENT-WELL", "S3-ACTION-PLAN", "REMOVED"],
        framework,
      ),
    ).toBe(2);
    expect(reflectionScore([], framework)).toBe(0);
  });

  test("averages a moment only over the researchers who marked it coded", () => {
    expect(momentScore({ R1: null, R2: null })).toBeNull();
    expect(momentScore({ R1: 6, R2: null })).toBe(6);
    expect(momentScore({ R1: null, R2: 0 })).toBe(0);
    expect(momentScore({ R1: 6, R2: 5 })).toBe(5.5);
  });

  test("averages a session over its coded moments", () => {
    expect(
      sessionReflectionAverage([
        { R1: 6, R2: 5 },
        { R1: 3, R2: null },
        { R1: null, R2: null },
      ]),
    ).toEqual({ average: 4.25, coded: 2, total: 3 });
    expect(sessionReflectionAverage([{ R1: null, R2: null }])).toEqual({
      average: null,
      coded: 0,
      total: 1,
    });
  });

  test("formats scores with a Swedish decimal comma", () => {
    expect(formatReflectionScore(5.5)).toBe("5,5");
    expect(formatReflectionScore(4.25)).toBe("4,3");
    expect(formatReflectionScore(7)).toBe("7");
  });
});
