import { alpha as packageAlpha } from "krippendorff";
import { describe, expect, test } from "vitest";

import {
  alphaGroups,
  groupedAlpha,
  krippendorffAlpha,
} from "@/lib/admin/krippendorff-alpha";

const _ = undefined;

describe("groupedAlpha", () => {
  test("counts each group as often as its weight, as if its units were repeated", () => {
    let seed = 9;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };

    for (let round = 0; round < 100; round++) {
      const groups = Array.from(
        { length: 2 + Math.floor(random() * 4) },
        () => {
          const units = 1 + Math.floor(random() * 6);
          return [0, 1].map(() =>
            Array.from({ length: units }, () => Math.floor(random() * 3)),
          );
        },
      );
      const weights = groups.map(() => Math.floor(random() * 3));
      const repeated = [0, 1].map((coder) =>
        groups.flatMap((group, g) =>
          Array.from({ length: weights[g] }, () => group[coder]).flat(),
        ),
      );

      const expected = packageAlpha(repeated);
      const actual = groupedAlpha(alphaGroups(groups), weights);
      if (Number.isFinite(expected)) {
        expect(actual).toBeCloseTo(expected, 10);
      } else {
        expect(actual).toBeNull();
      }
    }
  });
});

describe("krippendorffAlpha", () => {
  test("reproduces Krippendorff's published example with missing values", () => {
    // Krippendorff (2011), "Computing Krippendorff's Alpha-Reliability": four
    // coders, twelve units, nominal alpha 0.743.
    const ratings = [
      [1, 2, 3, 3, 2, 1, 4, 1, 2, _, _, _],
      [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, _, 3],
      [_, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, _],
      [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, _],
    ];
    expect(krippendorffAlpha(ratings)).toBeCloseTo(0.7434, 4);
  });

  test("works out a small two-coder case by hand", () => {
    // Ten values, three of them 1; one unit disagrees: 1 - 9 · 2 / (2 · 3 · 7).
    expect(
      krippendorffAlpha([
        [1, 1, 0, 0, 0],
        [1, 0, 0, 0, 0],
      ]),
    ).toBeCloseTo(4 / 7, 12);
  });

  test("is undefined without variation or without pairable values", () => {
    expect(
      krippendorffAlpha([
        [0, 0, 0],
        [0, 0, 0],
      ]),
    ).toBeNull();
    expect(krippendorffAlpha([[], []])).toBeNull();
    expect(
      krippendorffAlpha([
        [1, _, 0],
        [_, 1, _],
      ]),
    ).toBeNull();
  });

  test("gives the same values as the krippendorff package", () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    const squared = (a: number, b: number) => (a - b) ** 2;

    for (let round = 0; round < 300; round++) {
      const coders = 2 + Math.floor(random() * 3);
      const units = 1 + Math.floor(random() * 25);
      const values = 1 + Math.floor(random() * 5);
      const missing = round % 3 === 0 ? 0.2 : 0;
      const ratings = Array.from({ length: coders }, () =>
        Array.from({ length: units }, () =>
          random() < missing ? undefined : Math.floor(random() * values),
        ),
      );

      for (const distance of [undefined, squared]) {
        const expected = packageAlpha(ratings, distance);
        const actual = krippendorffAlpha(ratings, distance);
        if (Number.isFinite(expected)) {
          expect(actual).toBeCloseTo(expected, 10);
        } else {
          expect(actual).toBeNull();
        }
      }
    }
  });
});
