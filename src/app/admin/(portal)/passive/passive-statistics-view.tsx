import type { ReactNode } from "react";

import { CopyTextButton } from "@/app/admin/(portal)/passive/copy-text-button";

import {
  passivePrePostScatterLatex,
  passiveScatterLatex,
} from "@/lib/admin/passive-scatter-latex";
import type {
  PassiveAggregation,
  PassiveFigure,
  PassiveShare,
  PassiveStudents,
} from "@/lib/admin/passive-share";
import type { Interval, ShareStatistics } from "@/lib/admin/passive-statistics";

const SHARE = new Intl.NumberFormat("sv-SE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const POINTS = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const SIGNED_POINTS = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const STATISTIC = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const P_VALUE = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const RANK = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 });

const DASH = "–";

// The figures a paper reports for pre and post (DL-091).
export function PassiveStatistics({
  result,
  aggregation,
  selection,
}: {
  result: PassiveShare;
  aggregation: PassiveAggregation;
  selection: PassiveStudents;
}) {
  const { change } = result.statistics;
  const columns: [PassiveFigure, ShareStatistics][] = [
    [result.pre, result.statistics.pre],
    [result.post, result.statistics.post],
  ];
  const rows: [
    string,
    (figure: PassiveFigure, s: ShareStatistics) => string,
  ][] = [
    ["Andel passivt", (figure) => share(figure.share)],
    ["Standardavvikelse (SD)", (_, s) => points(s.sd)],
    ["Standardfel (SE)", (_, s) => points(s.se)],
    ["95 % konfidensintervall", (_, s) => shareInterval(s.interval)],
    ["Median", (_, s) => share(s.median)],
    ["Kvartiler (Q1; Q3)", (_, s) => shareInterval(s.quartiles)],
    ["Elever (n)", (figure) => String(figure.students)],
  ];

  return (
    <section
      aria-labelledby="passive-statistics"
      className="flex flex-col gap-3"
    >
      <h2
        id="passive-statistics"
        className="font-heading text-xl font-semibold"
      >
        Statistik för pre- och post-interaktion
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl border-collapse text-sm">
          <caption className="sr-only">Statistik för pre och post</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                <span className="sr-only">Mått</span>
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Pre (L1–2)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Post (L3–4)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, format]) => (
              <tr key={label} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {label}
                </th>
                {columns.map(([figure, statistics], index) => (
                  <td
                    key={index}
                    className="px-3 py-2 text-right whitespace-nowrap tabular-nums"
                  >
                    {format(figure, statistics)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
          SD och SE i procentenheter. SD, median och kvartiler beskriver
          spridningen mellan elevernas egna andelar.{" "}
          {aggregation === "mean"
            ? "SE och konfidensintervallet gäller medelvärdet per elev och bygger på t-fördelningen."
            : "SE och konfidensintervallet gäller den sammanslagna andelen och är klustrade per elev, eftersom en elevs koder inte är oberoende av varandra."}
        </p>
      </div>

      {result.pre.students > 0 ? (
        <div className="flex flex-col gap-1">
          <CopyTextButton
            text={passiveScatterLatex(result.pre.studentCodes, selection)}
          >
            Kopiera spridningsdiagram för pre (LaTeX)
          </CopyTextButton>
          <p className="max-w-3xl text-xs text-muted-foreground">
            En pgfplots-figur med varje elevs andel passivt mot antalet P-, A-
            och C-koder i lektion 1 och 2, för eleverna som valts ovan. Bara
            antal, inga deltagarkoder.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3">
        <h3 className="text-sm font-medium">
          Förändring per elev, pre till post
        </h3>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Bara de {studentCount(change.students)} som har P-, A- eller C-koder
          både pre och post, så att varje elev jämförs med sig själv. Bygger på
          elevernas egna andelar
          {aggregation === "pooled"
            ? ", också när koderna räknas sammanslagna, så medelförändringen kan skilja sig från Förändring ovan."
            : result.pre.students !== change.students ||
                result.post.students !== change.students
              ? ", så medelförändringen kan skilja sig från Förändring ovan, som räknar alla elever i varje period."
              : "."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Figure
            label="Medelförändring"
            value={
              change.mean === null ? DASH : `${signedPoints(change.mean)} p.e.`
            }
            details={[
              `95 % KI ${pointsInterval(change.interval)}`,
              `SD ${points(change.sd)}`,
            ]}
          />
          <Figure
            label="Parat t-test"
            value={
              change.t === null || change.df === null
                ? DASH
                : `t(${change.df}) = ${STATISTIC.format(change.t)}`
            }
            details={[
              pValue(change.p),
              <>
                Cohens d<sub>z</sub> = {statistic(change.dz)}
              </>,
            ]}
          />
          <Figure
            label="Wilcoxons teckenrangtest"
            value={
              change.wilcoxon === null
                ? DASH
                : `z = ${STATISTIC.format(change.wilcoxon.z)}`
            }
            details={
              change.wilcoxon === null
                ? []
                : [
                    pValue(change.wilcoxon.p),
                    <>
                      r<sub>rb</sub> ={" "}
                      {STATISTIC.format(change.wilcoxon.rankBiserial)}
                    </>,
                    <>
                      W<sup>+</sup> = {RANK.format(change.wilcoxon.wPlus)},{" "}
                      {studentCount(change.wilcoxon.n)} med förändring
                    </>,
                  ]
            }
          />
          <Figure
            label="Elever"
            value={`${change.down} ned · ${change.same} lika · ${change.up} upp`}
            details={["andelen passivt från pre till post"]}
          />
        </div>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Wilcoxon utan elever som inte förändrats, med normalapproximation och
          korrektion för lika rangtal men utan kontinuitetskorrektion, som SPSS.
        </p>
        {change.students > 0 ? (
          <div className="flex flex-col gap-1">
            <CopyTextButton
              text={passivePrePostScatterLatex(result.pairedCodes, selection)}
            >
              Kopiera spridningsdiagram för pre och post (LaTeX)
            </CopyTextButton>
            <p className="max-w-3xl text-xs text-muted-foreground">
              En pgfplots-figur med samma elever, där varje elevs andel passivt
              pre och post står mot antalet P-, A- och C-koder i respektive
              period och en linje förbinder elevens två punkter. Bara antal,
              inga deltagarkoder.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Figure({
  label,
  value,
  details,
}: {
  label: string;
  value: string;
  details: ReactNode[];
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
      {details.map((detail, index) => (
        <p key={index} className="text-xs text-muted-foreground tabular-nums">
          {detail}
        </p>
      ))}
    </div>
  );
}

function share(value: number | null): string {
  return value === null ? DASH : SHARE.format(value);
}

function points(value: number | null): string {
  return value === null ? DASH : `${POINTS.format(value * 100)} p.e.`;
}

function signedPoints(value: number): string {
  return SIGNED_POINTS.format(value * 100);
}

function statistic(value: number | null): string {
  return value === null ? DASH : STATISTIC.format(value);
}

// Semicolons, since the decimal comma would make a comma ambiguous.
function shareInterval(interval: Interval | null): string {
  return interval === null
    ? DASH
    : `[${SHARE.format(interval[0])}; ${SHARE.format(interval[1])}]`;
}

function pointsInterval(interval: Interval | null): string {
  return interval === null
    ? DASH
    : `[${signedPoints(interval[0])}; ${signedPoints(interval[1])}] p.e.`;
}

function pValue(p: number | null): string {
  if (p === null) return `p = ${DASH}`;
  return p < 0.001 ? "p < 0,001" : `p = ${P_VALUE.format(p)}`;
}

function studentCount(count: number): string {
  return `${count} ${count === 1 ? "elev" : "elever"}`;
}
