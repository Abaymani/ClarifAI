import { describe, expect, it } from "vitest";

import type {
  AdminParticipantOverview,
  AdminReflectionWords,
} from "@/lib/admin/types";

import { reflectionLengthLatex } from "./reflection-length-latex";

function participant(
  participantCode: string,
  words: Partial<Record<2 | 3, AdminReflectionWords>>,
): AdminParticipantOverview {
  return {
    participantCode,
    sessions: Object.fromEntries(
      Object.entries(words).map(([lesson, reflectionWords]) => [
        lesson,
        {
          participantCode,
          lesson: Number(lesson) as 2 | 3,
          state: "completed",
          status: "completed",
          transcriptSubmission: "transcript",
          codedBy: [],
          reflectionAssessment: { state: "unavailable" },
          reflectionWords,
        },
      ]),
    ),
  };
}

const submitted = (...moments: number[]): AdminReflectionWords => ({
  state: "submitted",
  moments,
});

const participants = [
  // Both: 100 words over 4 moments, so 25 per moment, not the mean of 20 and 40.
  participant("1", { 2: submitted(10, 20, 30), 3: submitted(40) }),
  participant("2", {
    2: submitted(5, 15),
    3: { state: "not_submitted", moments: 2 },
  }),
  participant("3", { 2: { state: "unavailable" }, 3: submitted(30, 50) }),
  // Both: 120 words over 4 moments.
  participant("4", { 2: submitted(20, 40), 3: submitted(10, 50) }),
  // No sessions at all.
  { participantCode: "5", sessions: {} },
];

const row = (latex: string, label: string) =>
  latex.split("\n").find((line) => line.trimStart().startsWith(`${label} &`));

describe("reflectionLengthLatex", () => {
  it("gives n, mean and SD per lesson for every submitted reflection", () => {
    const latex = reflectionLengthLatex(participants);

    // Lesson 2 totals 60, 20 and 60; per moment 20, 10 and 30.
    expect(row(latex, "Lesson 2")).toBe(
      String.raw`    Lesson 2 & 3 & 46.7 (23.1) & 20.0 (10.0) \\`,
    );
    // Lesson 3 totals 40, 80 and 60; per moment 40, 40 and 30.
    expect(row(latex, "Lesson 3")).toBe(
      String.raw`    Lesson 3 & 3 & 60.0 (20.0) & 36.7 (5.8) \\`,
    );
  });

  it("covers only students who submitted both lessons, pooling their moments", () => {
    expect(row(reflectionLengthLatex(participants), "Lessons 2 and 3")).toBe(
      String.raw`    Lessons 2 and 3 & 2 & 110.0 (14.1) & 27.5 (3.5) \\`,
    );
  });

  it("shows dashes where there is no mean or no spread", () => {
    const latex = reflectionLengthLatex([participants[1]]);

    expect(row(latex, "Lesson 2")).toBe(
      String.raw`    Lesson 2 & 1 & 20.0 (--) & 10.0 (--) \\`,
    );
    expect(row(latex, "Lessons 2 and 3")).toBe(
      String.raw`    Lessons 2 and 3 & 0 & -- & -- \\`,
    );
  });

  it("is a booktabs table with no participant codes", () => {
    const latex = reflectionLengthLatex([
      participant("4711", { 2: submitted(3) }),
    ]);

    expect(latex).toContain(String.raw`\toprule`);
    expect(latex).toContain(String.raw`\label{tab:reflection-length}`);
    expect(latex).toContain(String.raw`% Needs \usepackage{booktabs}`);
    expect(latex).not.toContain("4711");
    // Only comments may hold an unescaped percent sign.
    for (const line of latex.split("\n")) {
      if (!line.startsWith("%")) expect(line).not.toMatch(/(?<!\\)%/);
    }
  });
});
