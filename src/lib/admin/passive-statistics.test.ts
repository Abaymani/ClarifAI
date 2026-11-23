import { describe, expect, it } from "vitest";

import { pairedChange, shareStatistics } from "./passive-statistics";

// Expected values from SciPy 1.18.1 and NumPy on the same made-up codes.
const codes = (pairs: [number, number][]) =>
  pairs.map(([passive, total]) => ({ passive, total }));

// Shares 0.75, 0.2, 0, 1, 1/3 and 0.7.
const students = codes([
  [3, 4],
  [1, 5],
  [0, 2],
  [5, 5],
  [2, 6],
  [7, 10],
]);

describe("shareStatistics", () => {
  it("gives the mean's SD, SE and t interval over the students' shares", () => {
    const result = shareStatistics(students, "mean");

    expect(result.sd).toBeCloseTo(0.379534315044498, 10);
    expect(result.se).toBeCloseTo(0.15494423528928955, 10);
    expect(result.interval?.[0]).toBeCloseTo(0.09892538545101526, 8);
    expect(result.interval?.[1]).toBeCloseTo(0.8955190589934292, 8);
  });

  it("counts the median and quartiles as Excel's KVARTIL.INK does", () => {
    const result = shareStatistics(students, "mean");

    expect(result.median).toBeCloseTo(0.5166666666666666, 12);
    expect(result.quartiles?.[0]).toBeCloseTo(0.23333333333333334, 12);
    expect(result.quartiles?.[1]).toBeCloseTo(0.7375, 12);
  });

  it("clusters the pooled share's standard error by student", () => {
    const result = shareStatistics(students, "pooled");

    // 18 P of 32 codes; SD and quartiles still describe the students' shares.
    expect(result.se).toBeCloseTo(0.12661312644849465, 10);
    expect(result.interval?.[0]).toBeCloseTo(0.2370305969983758, 8);
    expect(result.interval?.[1]).toBeCloseTo(0.8879694030016242, 8);
    expect(result.sd).toBeCloseTo(0.379534315044498, 10);
    expect(result.median).toBeCloseTo(0.5166666666666666, 12);
  });

  it("leaves out what one student cannot give", () => {
    expect(shareStatistics(codes([[1, 4]]), "mean")).toEqual({
      sd: null,
      median: 0.25,
      quartiles: [0.25, 0.25],
      se: null,
      interval: null,
    });
    expect(shareStatistics([], "pooled")).toEqual({
      sd: null,
      median: null,
      quartiles: null,
      se: null,
      interval: null,
    });
  });
});

// Changes −1/2, −1/4, 0, 1/4, −1/2, −1/4, −1/4 and 1/8; totals are powers of two
// so that SciPy's floating-point ties match the exact ones.
const pairs = (
  [
    [3, 4, 1, 4],
    [6, 8, 4, 8],
    [1, 2, 1, 2],
    [2, 4, 3, 4],
    [7, 8, 3, 8],
    [4, 8, 2, 8],
    [1, 4, 0, 4],
    [5, 8, 6, 8],
  ] as const
).map(([preP, preN, postP, postN]) => ({
  pre: { passive: preP, total: preN },
  post: { passive: postP, total: postN },
}));

describe("pairedChange", () => {
  it("matches a paired t-test", () => {
    const result = pairedChange(pairs);

    expect(result.students).toBe(8);
    expect(result.mean).toBeCloseTo(-0.171875, 12);
    expect(result.sd).toBeCloseTo(0.2749797070434731, 10);
    expect(result.se).toBeCloseTo(0.09722000776956502, 10);
    expect(result.interval?.[0]).toBeCloseTo(-0.40176378811195235, 8);
    expect(result.interval?.[1]).toBeCloseTo(0.05801378811195232, 8);
    expect(result.df).toBe(7);
    expect(result.t).toBeCloseTo(-1.7678974106583634, 10);
    expect(result.p).toBeCloseTo(0.12040562648763045, 8);
    expect(result.dz).toBeCloseTo(-0.6250461237593337, 10);
  });

  it("counts the students who went down, stayed and went up", () => {
    expect(pairedChange(pairs)).toMatchObject({ down: 5, same: 1, up: 2 });
  });

  it("matches SciPy's Wilcoxon signed-rank test with tied ranks", () => {
    expect(pairedChange(pairs).wilcoxon).toEqual({
      n: 7,
      wPlus: 4.5,
      wMinus: 23.5,
      z: expect.closeTo(-1.638296331525062, 10),
      p: expect.closeTo(0.10135989258202958, 8),
      rankBiserial: expect.closeTo(-0.6785714285714286, 12),
    });
  });

  it("ties equal changes that floating point would tell apart", () => {
    // 0.7 − 0.4 and 0.4 − 0.1 differ in floating point but are both 3/10.
    const result = pairedChange([
      { pre: { passive: 4, total: 10 }, post: { passive: 7, total: 10 } },
      { pre: { passive: 1, total: 10 }, post: { passive: 4, total: 10 } },
      { pre: { passive: 1, total: 2 }, post: { passive: 0, total: 2 } },
    ]);

    expect(result.wilcoxon).toMatchObject({ wPlus: 3, wMinus: 3 });
  });

  it("gives no t or effect size when every student changed equally", () => {
    const result = pairedChange([
      { pre: { passive: 1, total: 2 }, post: { passive: 0, total: 2 } },
      { pre: { passive: 2, total: 4 }, post: { passive: 0, total: 4 } },
    ]);

    expect(result.mean).toBe(-0.5);
    expect(result.sd).toBe(0);
    expect(result.interval).toEqual([-0.5, -0.5]);
    expect(result).toMatchObject({ t: null, p: null, dz: null });
  });

  it("gives nothing to test without students in both periods", () => {
    expect(pairedChange([])).toMatchObject({
      students: 0,
      mean: null,
      sd: null,
      wilcoxon: null,
      down: 0,
      same: 0,
      up: 0,
    });
  });
});
