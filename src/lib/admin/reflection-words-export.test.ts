import { describe, expect, it } from "vitest";

import {
  reflectionWordsFileName,
  reflectionWordsSheet,
} from "@/lib/admin/reflection-words-export";
import type { AdminSessionSummary } from "@/lib/admin/types";

const base = {
  state: "completed" as const,
  status: "completed" as const,
  transcriptSubmission: "transcript" as const,
  codedBy: [],
  reflectionAssessment: { state: "unavailable" as const },
};

function session(
  participantCode: string,
  lesson: 2 | 3,
  reflectionWords: AdminSessionSummary["reflectionWords"],
): AdminSessionSummary {
  return { ...base, participantCode, lesson, reflectionWords };
}

describe("reflectionWordsSheet", () => {
  it("writes one row per participant and lesson, with a column per moment", () => {
    const sheet = reflectionWordsSheet([
      {
        participantCode: "801",
        sessions: {
          2: session("801", 2, { state: "submitted", moments: [51, 66, 16] }),
          3: session("801", 3, { state: "not_submitted", moments: 2 }),
        },
      },
      {
        participantCode: "802",
        sessions: {
          2: session("802", 2, { state: "submitted", moments: [2, 1210] }),
          3: session("802", 3, { state: "unavailable" }),
        },
      },
      // A code that is not only digits stays text; a participant with no
      // sessions still gets both rows.
      { participantCode: "T1", sessions: {} },
    ]);

    expect(sheet[0]).toEqual(
      [
        "Deltagare",
        "Lektion",
        "Status",
        "Antal moment",
        "Ord totalt",
        "Medel ord per moment",
        "M1",
        "M2",
        "M3",
      ].map((value) => ({ value, fontWeight: "bold" })),
    );
    expect(sheet.slice(1)).toEqual([
      [
        801,
        2,
        "Inskickad",
        3,
        133,
        { value: 133 / 3, format: "0.0" },
        51,
        66,
        16,
      ],
      [801, 3, "Ej inskickad", 2],
      [802, 2, "Inskickad", 2, 1212, { value: 606, format: "0.0" }, 2, 1210],
      [802, 3, "Ingen reflektion"],
      ["T1", 2, "Saknas"],
      ["T1", 3, "Saknas"],
    ]);
  });

  it("has only the fixed columns when no reflection was submitted", () => {
    expect(reflectionWordsSheet([])).toHaveLength(1);
    expect(reflectionWordsSheet([])[0]).toHaveLength(6);
  });
});

describe("reflectionWordsFileName", () => {
  it("names the file after the day it was made", () => {
    expect(reflectionWordsFileName(new Date(2026, 10, 20, 12))).toBe(
      "reflektionslangd-2026-11-20.xlsx",
    );
  });
});
