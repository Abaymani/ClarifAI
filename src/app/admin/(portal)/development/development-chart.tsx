import type { IcapLevel } from "@/lib/admin/icap-counts";
import {
  DEVELOPMENT_LEVELS,
  levelValue,
  totalCodes,
  type DevelopmentLesson,
  type DevelopmentScale,
} from "@/lib/admin/student-development";

export type DevelopmentForm = "bars" | "lines";

// One blue ramp, light to dark from P to C, since the levels are ordered.
export const LEVEL_COLOURS: Record<IcapLevel, string> = {
  P: "#86b6ef",
  A: "#3987e5",
  C: "#184f95",
};
export const LEVEL_NAMES: Record<IcapLevel, string> = {
  P: "Passiv",
  A: "Aktiv",
  C: "Konstruktiv",
};

const WIDTH = 176;
const HEIGHT = 92;
const LEFT = 34;
const TOP = 6;
const PLOT_WIDTH = WIDTH - LEFT - 4;
const PLOT_HEIGHT = HEIGHT - TOP - 16;
const BAR_WIDTH = 20;

const PERCENT = new Intl.NumberFormat("sv-SE", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function DevelopmentChart({
  lessons,
  form,
  scale,
  max,
  coderLabel,
}: {
  lessons: readonly DevelopmentLesson[];
  form: DevelopmentForm;
  scale: DevelopmentScale;
  // Shared by every card, so heights compare across participants.
  max: number;
  coderLabel: string;
}) {
  const x = (lesson: number) => LEFT + (PLOT_WIDTH * (lesson + 0.5)) / 4;
  const y = (value: number) =>
    TOP + PLOT_HEIGHT * (1 - (max > 0 ? value / max : 0));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label={describe(lessons, coderLabel)}
    >
      <line
        x1={LEFT}
        x2={WIDTH - 4}
        y1={y(0)}
        y2={y(0)}
        className="stroke-border"
      />
      <text
        x={LEFT - 4}
        y={y(max) + 8}
        textAnchor="end"
        className="fill-muted-foreground text-[10px]"
      >
        {scale === "share" ? "100 %" : max}
      </text>
      <text
        x={LEFT - 4}
        y={y(0)}
        textAnchor="end"
        className="fill-muted-foreground text-[10px]"
      >
        0
      </text>
      {lessons.map((_, index) => (
        <text
          key={index}
          x={x(index)}
          y={HEIGHT - 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          L{index + 1}
        </text>
      ))}

      {lessons.map((lesson, index) => {
        if (lesson.state === "coded") return null;
        // A faint band across the lesson's whole column: an outline the size of a
        // bar read as a predicted value.
        return (
          <rect
            key={`gap-${index}`}
            data-gap="band"
            x={x(index) - PLOT_WIDTH / 8}
            y={TOP}
            width={PLOT_WIDTH / 4}
            height={PLOT_HEIGHT}
            className="fill-muted-foreground/[0.07]"
          >
            <title>{`Lektion ${index + 1}: ${gapText(lesson, coderLabel)}`}</title>
          </rect>
        );
      })}

      {form === "bars"
        ? lessons.map((lesson, index) =>
            lesson.state === "coded" ? (
              <Bar
                key={index}
                lesson={index + 1}
                counts={lesson.counts}
                scale={scale}
                x={x(index) - BAR_WIDTH / 2}
                y={y}
              />
            ) : null,
          )
        : DEVELOPMENT_LEVELS.map((level) => (
            <Line
              key={level}
              level={level}
              lessons={lessons}
              scale={scale}
              x={x}
              y={y}
            />
          ))}
    </svg>
  );
}

function Bar({
  lesson,
  counts,
  scale,
  x,
  y,
}: {
  lesson: number;
  counts: Record<IcapLevel, number>;
  scale: DevelopmentScale;
  x: number;
  y: (value: number) => number;
}) {
  const total = totalCodes(counts);
  if (total === 0) {
    return (
      <rect
        x={x}
        y={y(0) - 2}
        width={BAR_WIDTH}
        height={2}
        className="fill-muted-foreground/40"
      >
        <title>{`Lektion ${lesson}: inga P-, A- eller C-koder, bara NA`}</title>
      </rect>
    );
  }

  const values = DEVELOPMENT_LEVELS.map(
    (level) => levelValue(counts, level, scale) ?? 0,
  );
  return (
    <g>
      {DEVELOPMENT_LEVELS.map((level, index) => {
        const below = values.slice(0, index).reduce((sum, v) => sum + v, 0);
        const top = y(below + values[index]);
        const height = y(below) - top;
        if (counts[level] === 0) return null;
        // A 2 px gap between segments, in the surface colour.
        return (
          <rect
            key={level}
            x={x}
            y={top + 1}
            width={BAR_WIDTH}
            height={Math.max(height - 2, 1)}
            rx={2}
            fill={LEVEL_COLOURS[level]}
          >
            <title>{markText(lesson, level, counts)}</title>
          </rect>
        );
      })}
    </g>
  );
}

function Line({
  level,
  lessons,
  scale,
  x,
  y,
}: {
  level: IcapLevel;
  lessons: readonly DevelopmentLesson[];
  scale: DevelopmentScale;
  x: (lesson: number) => number;
  y: (value: number) => number;
}) {
  const points = lessons.flatMap((lesson, index) => {
    if (lesson.state !== "coded") return [];
    const value = levelValue(lesson.counts, level, scale);
    return value === null ? [] : [{ index, value, counts: lesson.counts }];
  });

  return (
    <g>
      {points.slice(1).map((point, i) => {
        const previous = points[i];
        return (
          <line
            key={point.index}
            x1={x(previous.index)}
            y1={y(previous.value)}
            x2={x(point.index)}
            y2={y(point.value)}
            stroke={LEVEL_COLOURS[level]}
            strokeWidth={2}
            strokeLinecap="round"
            // Dashed across a lesson without coding, so a gap is not read as a step.
            strokeDasharray={
              point.index - previous.index > 1 ? "3 3" : undefined
            }
          />
        );
      })}
      {points.map((point) => (
        <circle
          key={point.index}
          cx={x(point.index)}
          cy={y(point.value)}
          r={3.5}
          fill={LEVEL_COLOURS[level]}
          strokeWidth={1.5}
          className="stroke-card"
        >
          <title>{markText(point.index + 1, level, point.counts)}</title>
        </circle>
      ))}
    </g>
  );
}

function markText(
  lesson: number,
  level: IcapLevel,
  counts: Record<IcapLevel, number>,
): string {
  const total = totalCodes(counts);
  return `Lektion ${lesson} · ${level} ${LEVEL_NAMES[level].toLowerCase()}: ${PERCENT.format(
    total === 0 ? 0 : counts[level] / total,
  )} (${counts[level]} av ${total} koder)`;
}

function gapText(lesson: DevelopmentLesson, coderLabel: string): string {
  return lesson.state === "noTranscript"
    ? "inget transkript"
    : `inte kodad av ${coderLabel}`;
}

function describe(
  lessons: readonly DevelopmentLesson[],
  coderLabel: string,
): string {
  return lessons
    .map((lesson, index) => {
      const prefix = `Lektion ${index + 1}: `;
      if (lesson.state !== "coded") return prefix + gapText(lesson, coderLabel);
      const { P, A, C } = lesson.counts;
      return `${prefix}P ${P}, A ${A}, C ${C}`;
    })
    .join(". ");
}
