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

const empty = (count: number) => Array.from({ length: count }, () => null);
const average = (value: number) => ({ value, format: "0.0" });

describe("reflectionWordsSheet", () => {
  it("writes one row per participant with both lessons side by side and pooled", () => {
    const { data, columns } = reflectionWordsSheet([
      {
        participantCode: "801",
        sessions: {
          2: session("801", 2, { state: "submitted", moments: [51, 66, 16] }),
          3: session("801", 3, { state: "submitted", moments: [9] }),
        },
      },
      {
        participantCode: "802",
        sessions: {
          2: session("802", 2, { state: "submitted", moments: [2, 1210] }),
          3: session("802", 3, { state: "not_submitted", moments: 2 }),
        },
      },
      {
        participantCode: "803",
        sessions: { 2: session("803", 2, { state: "unavailable" }) },
      },
      // A code that is not only digits stays text.
      { participantCode: "T1", sessions: {} },
    ]);

    const lessonHeader = (lesson: number) => [
      `L${lesson} Status`,
      `L${lesson} Antal moment`,
      `L${lesson} Ord totalt`,
      `L${lesson} Medel`,
      `L${lesson} M1`,
      `L${lesson} M2`,
      `L${lesson} M3`,
    ];
    expect(data[0]).toEqual(
      [
        "Deltagare",
        ...lessonHeader(2),
        ...lessonHeader(3),
        "L2+L3 Antal moment",
        "L2+L3 Ord totalt",
        "L2+L3 Medel",
      ].map((value) => ({ value, fontWeight: "bold" })),
    );
    expect(columns).toHaveLength(18);
    expect(data.slice(1)).toEqual([
      [
        801,
        ...["Inskickad", 3, 133, average(133 / 3), 51, 66, 16],
        ...["Inskickad", 1, 9, average(9), 9, null, null],
        // Pooled over all four moments, not the mean of 44,3 and 9.
        ...[4, 142, average(35.5)],
      ],
      [
        802,
        ...["Inskickad", 2, 1212, average(606), 2, 1210, null],
        // An unsubmitted lesson adds nothing to the pooled figures.
        ...["Ej inskickad", 2, ...empty(5)],
        ...[2, 1212, average(606)],
      ],
      [
        803,
        "Ingen reflektion",
        ...empty(6),
        "Saknas",
        ...empty(6),
        ...empty(3),
      ],
      ["T1", "Saknas", ...empty(6), "Saknas", ...empty(6), ...empty(3)],
    ]);
  });

  it("adds moment columns only to a lesson where a session had more than three", () => {
    const { data } = reflectionWordsSheet([
      {
        participantCode: "804",
        sessions: {
          3: session("804", 3, { state: "submitted", moments: [1, 2, 3, 4] }),
        },
      },
    ]);

    const header = data[0].map((cell) =>
      cell && typeof cell === "object" && "value" in cell ? cell.value : cell,
    );
    expect(header).toContain("L2 M3");
    expect(header).not.toContain("L2 M4");
    expect(header).toContain("L3 M4");
    expect(data[1]).toEqual([
      804,
      "Saknas",
      ...empty(6),
      ...["Inskickad", 4, 10, average(2.5), 1, 2, 3, 4],
      ...[4, 10, average(2.5)],
    ]);
  });

  it("keeps the full header when there are no participants", () => {
    const { data, columns } = reflectionWordsSheet([]);
    expect(data).toHaveLength(1);
    expect(data[0]).toHaveLength(18);
    expect(columns).toHaveLength(18);
  });
});

describe("reflectionWordsFileName", () => {
  it("names the file after the day it was made", () => {
    expect(reflectionWordsFileName(new Date(2026, 10, 20, 12))).toBe(
      "reflektionslangd-2026-11-20.xlsx",
    );
  });
});
