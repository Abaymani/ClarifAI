// Krippendorff's alpha from the coincidences of values within each unit
// (Krippendorff 2011, "Computing Krippendorff's Alpha-Reliability"). Our own
// version because the `krippendorff` package compares every pair of distinct
// values for every unit, which took minutes on whole code sets (DL-076); the tests
// check that both give the same values.
export type Rating = string | number;

// Each row holds one coder's values, one per unit; undefined where the coder has
// none.
export type RatingMatrix<R extends Rating> = readonly (readonly (
  R | undefined
)[])[];

// Alpha's ingredients add up over units, so they are summed once per group of
// units, such as a transcript's prompts, and a bootstrap only reweights the groups
// (DL-077). The expected disagreement sums over pairs of values, so it is kept per
// pair of groups in `cross`; a draw then weights groups, not values.
export type AlphaGroups = {
  groups: { pairable: number; observed: number }[];
  cross: Float64Array[];
};

export function alphaGroups<R extends Rating>(
  groups: readonly RatingMatrix<R>[],
  distance: (a: R, b: R) => number = (a, b) => (a === b ? 0 : 1),
): AlphaGroups {
  const numbers = new Map<R, number>();
  const values: R[] = [];
  const numberOf = (value: R) => {
    let number = numbers.get(value);
    if (number === undefined) {
      number = values.length;
      numbers.set(value, number);
      values.push(value);
    }
    return number;
  };
  const units = groups.map((ratings) =>
    Array.from(
      { length: Math.max(0, ...ratings.map((row) => row.length)) },
      (_, unit) =>
        ratings
          .map((row) => row[unit])
          .filter((value): value is R => value !== undefined)
          .map(numberOf),
    ),
  );
  const distances = values.map((a) => values.map((b) => distance(a, b)));

  const parts = units.map((group) => {
    let pairable = 0;
    let observed = 0;
    const totals = new Map<number, number>();
    for (const unit of group) {
      if (unit.length < 2) continue;
      pairable += unit.length;
      for (const [i, value] of unit.entries()) {
        totals.set(value, (totals.get(value) ?? 0) + 1);
        for (const [j, other] of unit.entries()) {
          if (i !== j) observed += distances[value][other] / (unit.length - 1);
        }
      }
    }
    return { pairable, observed, totals };
  });

  return {
    groups: parts.map(({ pairable, observed }) => ({ pairable, observed })),
    cross: parts.map(({ totals }) =>
      Float64Array.from(parts, (other) => {
        let sum = 0;
        for (const [value, count] of totals) {
          for (const [otherValue, otherCount] of other.totals) {
            sum += count * otherCount * distances[value][otherValue];
          }
        }
        return sum;
      }),
    ),
  };
}

// Null when alpha is undefined: fewer than two pairable values, or no variation to
// agree about. `weights` says how many times each group counts, as a bootstrap
// draws them; without it every group counts once.
export function groupedAlpha(
  input: AlphaGroups,
  weights?: readonly number[],
): number | null {
  const count = input.groups.length;
  const weight = weights ?? new Array<number>(count).fill(1);
  let pairable = 0;
  let observed = 0;
  let expected = 0;
  for (let g = 0; g < count; g++) {
    if (weight[g] === 0) continue;
    pairable += weight[g] * input.groups[g].pairable;
    observed += weight[g] * input.groups[g].observed;
    const row = input.cross[g];
    let sum = 0;
    for (let h = 0; h < count; h++) sum += weight[h] * row[h];
    expected += weight[g] * sum;
  }
  if (pairable < 2 || expected === 0) return null;
  return 1 - ((pairable - 1) * observed) / expected;
}

export function krippendorffAlpha<R extends Rating>(
  ratings: RatingMatrix<R>,
  distance?: (a: R, b: R) => number,
): number | null {
  return groupedAlpha(alphaGroups([ratings], distance));
}
