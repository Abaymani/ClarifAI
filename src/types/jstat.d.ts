// jStat ships no types; only the functions the passive-share statistics use.
declare module "jstat" {
  export const jStat: {
    mean(values: readonly number[]): number;
    stdev(values: readonly number[], sample: true): number;
    median(values: readonly number[]): number;
    quantiles(
      values: readonly number[],
      quantiles: readonly number[],
      alphap: number,
      betap: number,
    ): number[];
    studentt: {
      cdf(x: number, degreesOfFreedom: number): number;
      inv(p: number, degreesOfFreedom: number): number;
    };
    normal: {
      cdf(x: number, mean: number, standardDeviation: number): number;
    };
  };
}
