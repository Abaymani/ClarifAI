import type { Row, SheetData } from "write-excel-file/universal";

import { averageWords, totalWords } from "@/lib/admin/reflection-words";
import type { AdminParticipantOverview } from "@/lib/admin/types";

// Students only reflect in lessons 2 and 3.
const LESSONS = [2, 3] as const;

const HEADER = [
  "Deltagare",
  "Lektion",
  "Status",
  "Antal moment",
  "Ord totalt",
  "Medel ord per moment",
];

// One row per participant and lesson, with every participant included whatever
// the page's search or filters show (DL-086).
export function reflectionWordsSheet(
  participants: readonly AdminParticipantOverview[],
): SheetData {
  const widestSession = Math.max(
    0,
    ...participants.flatMap((participant) =>
      LESSONS.map((lesson) => {
        const words = participant.sessions[lesson]?.reflectionWords;
        return words?.state === "submitted" ? words.moments.length : 0;
      }),
    ),
  );
  const header: Row = [
    ...HEADER,
    ...Array.from({ length: widestSession }, (_, index) => `M${index + 1}`),
  ].map((value) => ({ value, fontWeight: "bold" }));

  const rows = participants.flatMap((participant) =>
    LESSONS.map((lesson): Row => {
      const session = participant.sessions[lesson];
      const words = session?.reflectionWords;
      const start: Row = [participantCell(participant.participantCode), lesson];
      if (!session) return [...start, "Saknas"];
      if (!words || words.state === "unavailable") {
        return [...start, "Ingen reflektion"];
      }
      if (words.state === "not_submitted") {
        return [...start, "Ej inskickad", words.moments];
      }
      // Unrounded, shown with one decimal like the page.
      const average = averageWords(words.moments);
      return [
        ...start,
        "Inskickad",
        words.moments.length,
        totalWords(words.moments),
        average === null ? null : { value: average, format: "0.0" },
        ...words.moments,
      ];
    }),
  );

  return [header, ...rows];
}

// Numeric codes are written as numbers so Excel sorts them as numbers.
function participantCell(code: string): string | number {
  return /^\d+$/.test(code) ? Number(code) : code;
}

export function reflectionWordsFileName(now: Date = new Date()): string {
  return `reflektionslangd-${now.toLocaleDateString("sv-SE")}.xlsx`;
}
