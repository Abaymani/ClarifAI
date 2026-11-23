// Spread, intervals and a paired pre/post comparison for the passive share
// (DL-091), so the pre and post figures can be reported in a paper. DL-091 states
// each method; change both together.
import { jStat } from "jstat";

import type { PassiveAggregation } from "@/lib/admin/passive-share";

// One student's P codes and P + A + C codes over a period.
export type StudentCodes = { passive: number; total: number };
// One student's codes before and after the interaction.
export type StudentPair = { pre: StudentCodes; post: StudentCodes };

export type Interval = [lower: number, upper: number];

export type ShareStatistics = {
  // The students' own shares, whichever way the group figure is counted.
  sd: number | null;
  median: number | null;
  quartiles: Interval | null;
  // The group figure's uncertainty: from the students' shares for the mean,
  // clustered by student for pooled codes, since one student's codes are not
  // independent of each other.
  se: number | null;
  interval: Interval | null;
};

export type WilcoxonResult = {
  // Students whose share changed; unchanged students are left out.
  n: number;
  wPlus: number;
  wMinus: number;
  z: number;
  p: number;
  // Matched-pairs rank-biserial correlation, as jamovi and JASP report it.
  rankBiserial: number;
};

export type PairedChange = {
  // Students with P, A or C codes both pre and post.
  students: number;
  mean: number | null;
  sd: number | null;
  se: number | null;
  interval: Interval | null;
  t: number | null;
  df: number | null;
  p: number | null;
  // Cohen's d for paired samples: the mean change over its standard deviation.
  dz: number | null;
  down: number;
  same: number;
  up: number;
  wilcoxon: WilcoxonResult | null;
};

export function shareStatistics(
  students: readonly StudentCodes[],
  aggregation: PassiveAggregation,
): ShareStatistics {
  const shares = students.map((student) => student.passive / student.total);
  const n = shares.length;
  const statistics: ShareStatistics = {
    sd: null,
    median: null,
    quartiles: null,
    se: null,
    interval: null,
  };
  if (n === 0) return statistics;

  statistics.median = jStat.median(shares);
  statistics.quartiles = quartiles(shares);
  if (n < 2) return statistics;

  statistics.sd = jStat.stdev(shares, true);
  let centre: number;
  if (aggregation === "mean") {
    centre = jStat.mean(shares);
    statistics.se = statistics.sd / Math.sqrt(n);
  } else {
    const passive = sum(students.map((student) => student.passive));
    const total = sum(students.map((student) => student.total));
    centre = passive / total;
    // The ratio estimator's variance (Cochran 1977, 6.13), each student a cluster.
    const residuals = sum(
      students.map(
        (student) => (student.passive - centre * student.total) ** 2,
      ),
    );
    statistics.se = Math.sqrt((n / (n - 1)) * residuals) / total;
  }
  statistics.interval = tInterval(centre, statistics.se, n - 1);
  return statistics;
}

export function pairedChange(pairs: readonly StudentPair[]): PairedChange {
  // Kept as fractions so that equal changes tie exactly in the Wilcoxon ranks.
  const changes = pairs.map(({ pre, post }) => ({
    numerator: post.passive * pre.total - pre.passive * post.total,
    denominator: post.total * pre.total,
  }));
  const values = changes.map((change) => change.numerator / change.denominator);
  const n = values.length;
  const result: PairedChange = {
    students: n,
    mean: null,
    sd: null,
    se: null,
    interval: null,
    t: null,
    df: null,
    p: null,
    dz: null,
    down: changes.filter((change) => change.numerator < 0).length,
    same: changes.filter((change) => change.numerator === 0).length,
    up: changes.filter((change) => change.numerator > 0).length,
    wilcoxon: wilcoxonSignedRank(changes),
  };
  if (n === 0) return result;

  result.mean = jStat.mean(values);
  if (n < 2) return result;

  result.sd = jStat.stdev(values, true);
  result.se = result.sd / Math.sqrt(n);
  result.df = n - 1;
  result.interval = tInterval(result.mean, result.se, result.df);
  // Every student changed by the same amount, so t and d_z have no value.
  if (result.sd === 0) return result;

  result.t = result.mean / result.se;
  result.p = 2 * jStat.studentt.cdf(-Math.abs(result.t), result.df);
  result.dz = result.mean / result.sd;
  return result;
}

type Fraction = { numerator: number; denominator: number };

// Normal approximation with the correction for tied ranks and no continuity
// correction, as SPSS reports it; unchanged students are dropped first.
function wilcoxonSignedRank(
  changes: readonly Fraction[],
): WilcoxonResult | null {
  const sorted = changes
    .filter((change) => change.numerator !== 0)
    .sort(compareSize);
  const n = sorted.length;
  if (n === 0) return null;

  let wPlus = 0;
  let wMinus = 0;
  let ties = 0;
  for (let start = 0; start < n;) {
    let end = start + 1;
    while (end < n && compareSize(sorted[start], sorted[end]) === 0) end++;
    const tied = end - start;
    // Ranks start + 1 to end, averaged over the tie.
    const rank = (start + 1 + end) / 2;
    for (let i = start; i < end; i++) {
      if (sorted[i].numerator > 0) wPlus += rank;
      else wMinus += rank;
    }
    ties += tied ** 3 - tied;
    start = end;
  }

  const expected = (n * (n + 1)) / 4;
  const variance = (n * (n + 1) * (2 * n + 1)) / 24 - ties / 48;
  const z = (wPlus - expected) / Math.sqrt(variance);
  return {
    n,
    wPlus,
    wMinus,
    z,
    p: 2 * jStat.normal.cdf(-Math.abs(z), 0, 1),
    rankBiserial: (wPlus - wMinus) / (wPlus + wMinus),
  };
}

// Compares |a| with |b| without rounding.
function compareSize(a: Fraction, b: Fraction): number {
  return (
    Math.abs(a.numerator) * b.denominator -
    Math.abs(b.numerator) * a.denominator
  );
}

function tInterval(centre: number, se: number, df: number): Interval {
  const margin = jStat.studentt.inv(0.975, df) * se;
  return [centre - margin, centre + margin];
}

// Linear interpolation between order statistics (Hyndman and Fan's type 7), as
// Excel's KVARTIL.INK and R's quantile() count them.
function quartiles(values: readonly number[]): Interval {
  // jStat interpolates past the end of a single value.
  if (values.length === 1) return [values[0], values[0]];
  const [q1, q3] = jStat.quantiles(values, [0.25, 0.75], 1, 1);
  return [q1, q3];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
