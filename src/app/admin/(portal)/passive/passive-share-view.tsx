"use client";

import { useMemo, useState } from "react";

import { LEVEL_COLOURS } from "@/app/admin/(portal)/development/development-chart";
import { SegmentedControl } from "@/app/admin/(portal)/segmented-control";
import {
  passiveShare,
  type PassiveAggregation,
  type PassiveFigure,
  type PassiveStudents,
} from "@/lib/admin/passive-share";
import type { StudentDevelopment } from "@/lib/admin/student-development";

const PERCENT = new Intl.NumberFormat("sv-SE", {
  style: "percent",
  maximumFractionDigits: 0,
});
// One decimal in the figures and the table, so that pre and post, as shown, add up
// to the change; the chart labels stay whole.
const PRECISE = new Intl.NumberFormat("sv-SE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const POINTS = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

export function PassiveShareView({
  students,
}: {
  students: StudentDevelopment[];
}) {
  const [aggregation, setAggregation] = useState<PassiveAggregation>("mean");
  const [selection, setSelection] = useState<PassiveStudents>("all");
  const result = useMemo(
    () => passiveShare(students, aggregation, selection),
    [students, aggregation, selection],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <SegmentedControl
          label="Räkna som"
          value={aggregation}
          onChange={setAggregation}
          options={[
            ["mean", "Medel per elev"],
            ["pooled", "Alla koder sammanslagna"],
          ]}
        />
        <SegmentedControl
          label="Elever"
          value={selection}
          onChange={setSelection}
          options={[
            ["all", "Alla med AI-kodning"],
            ["allFour", "Bara alla fyra lektioner"],
          ]}
        />
      </div>
      <p className="-mt-2 max-w-3xl text-xs text-muted-foreground">
        {aggregation === "mean"
          ? "Varje elevs andel räknas först och sedan medelvärdet, så alla elever väger lika."
          : "Alla P-koder delat med alla koder, så elever med fler koder väger mer."}{" "}
        {selection === "allFour"
          ? "Bara elever med AI-kodning i alla fyra lektionerna, så varje siffra bygger på samma elever."
          : "Alla elever med AI-kodning i lektionen; vilka elever som ingår kan skilja mellan lektionerna."}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile
          label="Pre-interaktion"
          sub="lektion 1 och 2"
          value={formatShare(result.pre.share, PRECISE)}
          detail={figureDetail(result.pre)}
        />
        <Tile
          label="Post-interaktion"
          sub="lektion 3 och 4"
          value={formatShare(result.post.share, PRECISE)}
          detail={figureDetail(result.post)}
        />
        <Tile
          label="Förändring"
          sub="från pre till post"
          value={
            result.change === null
              ? "–"
              : `${POINTS.format(result.change * 100)} p.e.`
          }
        />
      </div>

      <figure className="flex flex-col gap-1">
        <PassiveChart lessons={result.lessons} />
        <figcaption className="text-xs text-muted-foreground">
          Prickar är enskilda elever och linjen är gruppen. n är antalet elever
          med P-, A- eller C-koder i lektionen.
        </figcaption>
      </figure>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <caption className="sr-only">Andel passiva koder per lektion</caption>
          <thead>
            <tr className="border-b text-muted-foreground">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                <span className="sr-only">Mått</span>
              </th>
              {["L1", "L2", "L3", "L4", "Pre (L1–2)", "Post (L3–4)"].map(
                (heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-3 py-2 text-right font-medium"
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {(
              [
                ["Andel passivt", (f) => formatShare(f.share, PRECISE)],
                ["Elever", (f) => String(f.students)],
                ["Koder", (f) => String(f.codes)],
                ["Promptar", (f) => String(f.prompts)],
              ] as [string, (figure: PassiveFigure) => string][]
            ).map(([label, format]) => (
              <tr key={label} className="border-b last:border-0">
                <th scope="row" className="py-2 pr-3 text-left font-medium">
                  {label}
                </th>
                {[...result.lessons, result.pre, result.post].map(
                  (figure, index) => (
                    <td
                      key={index}
                      className="px-3 py-2 text-right tabular-nums"
                    >
                      {format(figure)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">
          Promptar räknar promptar med minst en P-, A- eller C-kod. En prompt
          kan ha flera koder, så det kan finnas fler koder än promptar.
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  sub,
  value,
  detail,
}: {
  label: string;
  sub: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      {detail ? (
        <p className="text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

const WIDTH = 640;
const HEIGHT = 210;
const LEFT = 48;
const TOP = 12;
const PLOT_WIDTH = WIDTH - LEFT - 12;
const PLOT_HEIGHT = HEIGHT - TOP - 40;

function PassiveChart({ lessons }: { lessons: PassiveFigure[] }) {
  const x = (index: number) => LEFT + (PLOT_WIDTH * (index + 0.5)) / 4;
  const y = (share: number) => TOP + PLOT_HEIGHT * (1 - share);
  const colour = LEVEL_COLOURS.P;
  const points = lessons.flatMap((lesson, index) =>
    lesson.share === null ? [] : [{ index, share: lesson.share }],
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full max-w-4xl"
      role="img"
      aria-label={lessons
        .map(
          (lesson, index) =>
            `Lektion ${index + 1}: ${formatShare(lesson.share)}, ${studentCount(lesson.students)}`,
        )
        .join(". ")}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
        <g key={tick}>
          <line
            x1={LEFT}
            x2={WIDTH - 12}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-border"
          />
          <text
            x={LEFT - 6}
            y={y(tick) + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[11px]"
          >
            {PERCENT.format(tick)}
          </text>
        </g>
      ))}

      {lessons.map((lesson, index) => (
        <g key={index}>
          {lesson.studentShares.map((share, student) => (
            <circle
              key={student}
              data-student
              // Spread the dots sideways so students with the same share stay visible.
              cx={x(index) + (((student * 37) % 23) - 11) * 1.6}
              cy={y(share)}
              r={3}
              fill={colour}
              opacity={0.25}
            />
          ))}
          <text
            x={x(index)}
            y={HEIGHT - 20}
            textAnchor="middle"
            className="fill-foreground text-[12px]"
          >
            Lektion {index + 1}
          </text>
          <text
            x={x(index)}
            y={HEIGHT - 5}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            n = {lesson.students}
          </text>
        </g>
      ))}

      {points.slice(1).map((point, i) => {
        const previous = points[i];
        return (
          <line
            key={point.index}
            x1={x(previous.index)}
            y1={y(previous.share)}
            x2={x(point.index)}
            y2={y(point.share)}
            stroke={colour}
            strokeWidth={2}
            strokeDasharray={
              point.index - previous.index > 1 ? "4 3" : undefined
            }
          />
        );
      })}
      {points.map((point) => (
        <g key={point.index}>
          <circle
            data-group
            cx={x(point.index)}
            cy={y(point.share)}
            r={5}
            fill={colour}
            strokeWidth={2}
            className="stroke-card"
          >
            <title>{`Lektion ${point.index + 1}: ${formatShare(point.share)} passivt, ${studentCount(lessons[point.index].students)}`}</title>
          </circle>
          <text
            x={x(point.index) + 10}
            y={y(point.share) - 8}
            className="fill-foreground text-[12px] font-medium"
          >
            {formatShare(point.share)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function formatShare(
  share: number | null,
  format: Intl.NumberFormat = PERCENT,
): string {
  return share === null ? "–" : format.format(share);
}

function figureDetail(figure: PassiveFigure): string {
  return `${studentCount(figure.students)} · ${figure.codes} ${figure.codes === 1 ? "kod" : "koder"}`;
}

function studentCount(count: number): string {
  return `${count} ${count === 1 ? "elev" : "elever"}`;
}
