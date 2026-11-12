import { describe, expect, it } from "vitest";

import { chartMax } from "@/app/admin/(portal)/development/development-chart";
import type { DevelopmentLesson } from "@/lib/admin/student-development";

const coded = (P: number, A: number, C: number): DevelopmentLesson => ({
  state: "coded",
  counts: { P, A, C },
});
const uncoded: DevelopmentLesson = { state: "uncoded" };

describe("chartMax", () => {
  const lessons = [coded(3, 1, 0), uncoded, coded(1, 2, 2), coded(0, 0, 0)];

  it("keeps stacked shares at 100 %", () => {
    expect(chartMax(lessons, "bars", "share")).toBe(1);
  });

  it("uses the card's largest lesson for stacked counts", () => {
    expect(chartMax(lessons, "bars", "count")).toBe(5);
  });

  it("uses the card's largest single level for line counts", () => {
    expect(chartMax(lessons, "lines", "count")).toBe(3);
  });

  it("rounds the largest line share up to the next ten per cent", () => {
    // P is 75 % in the first lesson.
    expect(chartMax(lessons, "lines", "share")).toBe(0.8);
    // Exactly 40 % stays at 40 %, despite floating point.
    expect(chartMax([coded(3, 3, 4)], "lines", "share")).toBe(0.4);
    expect(chartMax([coded(3, 3, 3), coded(0, 3, 7)], "lines", "share")).toBe(
      0.7,
    );
    expect(chartMax([coded(1, 0, 0)], "lines", "share")).toBe(1);
  });

  it("never gives an empty axis", () => {
    expect(chartMax([uncoded, coded(0, 0, 0)], "bars", "count")).toBe(1);
    expect(chartMax([uncoded], "lines", "share")).toBe(0.1);
  });
});
