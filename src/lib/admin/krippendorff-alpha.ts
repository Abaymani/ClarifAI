// Krippendorff's alpha from the coincidences of values within each unit
// (Krippendorff 2011, "Computing Krippendorff's Alpha-Reliability"). Our own
// version because the `krippendorff` package compares every pair of distinct
// values for every unit, which took minutes on whole code sets (DL-076); the tests
// check that both give the same values.
export type Rating = string | number;

// Each row holds one coder's values, one per unit; undefined where the coder has
// none. Null when alpha is undefined: fewer than two pairable values, or no
// variation to agree about.
export function krippendorffAlpha<R extends Rating>(
  ratings: readonly (readonly (R | undefined)[])[],
  distance: (a: R, b: R) => number = (a, b) => (a === b ? 0 : 1),
): number | null {
  const coincidences = new Map<R, Map<R, number>>();
  const totals = new Map<R, number>();
  let pairable = 0;

  const units = Math.max(0, ...ratings.map((row) => row.length));
  for (let unit = 0; unit < units; unit++) {
    const values = ratings
      .map((row) => row[unit])
      .filter((value): value is R => value !== undefined);
    if (values.length < 2) continue;
    const weight = 1 / (values.length - 1);
    for (const [i, value] of values.entries()) {
      totals.set(value, (totals.get(value) ?? 0) + 1);
      const row = coincidences.get(value) ?? new Map<R, number>();
      for (const [j, other] of values.entries()) {
        if (i !== j) row.set(other, (row.get(other) ?? 0) + weight);
      }
      coincidences.set(value, row);
    }
    pairable += values.length;
  }

  let observed = 0;
  for (const [value, row] of coincidences) {
    for (const [other, count] of row) {
      observed += count * distance(value, other);
    }
  }
  let expected = 0;
  for (const [value, count] of totals) {
    for (const [other, otherCount] of totals) {
      expected += count * otherCount * distance(value, other);
    }
  }
  if (pairable < 2 || expected === 0) return null;
  return 1 - ((pairable - 1) * observed) / expected;
}
