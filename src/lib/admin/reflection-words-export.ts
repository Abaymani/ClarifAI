import type { Cell, Row, SheetData } from "write-excel-file/universal";

import {
  averageWords,
  pooledMoments,
  totalWords,
} from "@/lib/admin/reflection-words";
import type { AdminParticipantOverview } from "@/lib/admin/types";

// Students only reflect in lessons 2 and 3.
const LESSONS = [2, 3] as const;

// The study's lessons had up to three moments, so M1–M3 are always there and the
// layout stays the same between downloads; more appear only if a session had more.
const MIN_MOMENT_COLUMNS = 3;

type Column = { label: string; width: number };

export type ReflectionWordsSheet = {
  data: SheetData;
  columns: { width: number }[];
};

// One row per participant, lessons 2 and 3 side by side and then both pooled,
// with every participant included whatever the page's search or filters show
// (DL-086, DL-088).
export function reflectionWordsSheet(
  participants: readonly AdminParticipantOverview[],
): ReflectionWordsSheet {
  const momentColumns = Object.fromEntries(
    LESSONS.map((lesson) => [
      lesson,
      Math.max(
        MIN_MOMENT_COLUMNS,
        ...participants.map((participant) => {
          const words = participant.sessions[lesson]?.reflectionWords;
          return words?.state === "submitted" ? words.moments.length : 0;
        }),
      ),
    ]),
  ) as Record<(typeof LESSONS)[number], number>;

  const columns: Column[] = [
    { label: "Deltagare", width: 11 },
    ...LESSONS.flatMap((lesson): Column[] => [
      { label: `L${lesson} Status`, width: 18 },
      { label: `L${lesson} Antal moment`, width: 17 },
      { label: `L${lesson} Ord totalt`, width: 14 },
      { label: `L${lesson} Medel`, width: 11 },
      ...Array.from({ length: momentColumns[lesson] }, (_, index) => ({
        label: `L${lesson} M${index + 1}`,
        width: 8,
      })),
    ]),
    { label: "L2+L3 Antal moment", width: 20 },
    { label: "L2+L3 Ord totalt", width: 17 },
    { label: "L2+L3 Medel", width: 13 },
  ];

  const rows = participants.map((participant): Row => {
    const pooled = pooledMoments(
      LESSONS.map((lesson) => participant.sessions[lesson]?.reflectionWords),
    );
    return [
      participantCell(participant.participantCode),
      ...LESSONS.flatMap((lesson) =>
        lessonCells(participant, lesson, momentColumns[lesson]),
      ),
      ...(pooled.length === 0
        ? [null, null, null]
        : [pooled.length, totalWords(pooled), averageCell(pooled)]),
    ];
  });

  return {
    data: [
      columns.map(({ label }) => ({ value: label, fontWeight: "bold" })),
      ...rows,
    ],
    columns: columns.map(({ width }) => ({ width })),
  };
}

// Always the same number of cells, so every lesson's columns line up.
function lessonCells(
  participant: AdminParticipantOverview,
  lesson: (typeof LESSONS)[number],
  momentColumns: number,
): Cell[] {
  const session = participant.sessions[lesson];
  const words = session?.reflectionWords;
  const [status, moments, total, average, counts]: [
    string,
    number | null,
    number | null,
    Cell,
    number[],
  ] = !session
    ? ["Saknas", null, null, null, []]
    : !words || words.state === "unavailable"
      ? ["Ingen reflektion", null, null, null, []]
      : words.state === "not_submitted"
        ? ["Ej inskickad", words.moments, null, null, []]
        : [
            "Inskickad",
            words.moments.length,
            totalWords(words.moments),
            averageCell(words.moments),
            words.moments,
          ];
  return [
    status,
    moments,
    total,
    average,
    ...Array.from(
      { length: momentColumns },
      (_, index): Cell => counts[index] ?? null,
    ),
  ];
}

// Unrounded, shown with one decimal like the page.
function averageCell(moments: readonly number[]): Cell {
  const average = averageWords(moments);
  return average === null ? null : { value: average, format: "0.0" };
}

// Numeric codes are written as numbers so Excel sorts them as numbers.
function participantCell(code: string): string | number {
  return /^\d+$/.test(code) ? Number(code) : code;
}

export function reflectionWordsFileName(now: Date = new Date()): string {
  return `reflektionslangd-${now.toLocaleDateString("sv-SE")}.xlsx`;
}
