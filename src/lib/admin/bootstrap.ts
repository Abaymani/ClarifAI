// Percentile intervals from redrawing whole groups, such as transcripts, with
// replacement: prompts in one transcript are not independent of each other
// (DL-077). A fixed seed makes the same data give the same intervals.
export type Interval = [number, number];

// `statistics` gets how many times each group was drawn and returns the same
// number of values every time. A statistic gets no interval when any draw leaves it
// undefined, or when there are fewer than two groups to draw from.
export function bootstrapIntervals(
  groups: number,
  statistics: (weights: number[]) => readonly (number | null)[],
  options: { resamples: number; seed: number; level?: number },
): (Interval | null)[] {
  if (groups < 2) {
    return statistics(new Array<number>(groups).fill(1)).map(() => null);
  }

  const random = mulberry32(options.seed);
  let draws: { values: number[]; complete: boolean }[] = [];
  for (let draw = 0; draw < options.resamples; draw++) {
    const weights = new Array<number>(groups).fill(0);
    for (let i = 0; i < groups; i++) {
      weights[Math.floor(random() * groups)] += 1;
    }
    const results = statistics(weights);
    if (draw === 0) draws = results.map(() => ({ values: [], complete: true }));
    results.forEach((value, s) => {
      if (value === null) draws[s].complete = false;
      else draws[s].values.push(value);
    });
  }

  const tail = (1 - (options.level ?? 0.95)) / 2;
  return draws.map(({ values, complete }) =>
    complete ? [quantile(values, tail), quantile(values, 1 - tail)] : null,
  );
}

// Linear interpolation between the closest ranks, as R's and NumPy's defaults do.
export function quantile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const position = p * (sorted.length - 1);
  const below = Math.floor(position);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
}

// mulberry32: a small seeded generator, since Math.random cannot be seeded.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
