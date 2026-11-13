import { describe, expect, it } from "vitest";

import type { AgreementSessionInput } from "@/lib/admin/coder-agreement";
import type { LessonOneCodes } from "@/lib/admin/lesson-one-codes";
import type { Lesson } from "@/lib/session/credentials";

import {
  levelChange,
  levelValue,
  studentDevelopment,
  type DevelopmentLesson,
} from "./student-development";

const framework = {
  promptCodes: [
    { code: "P2", name: "Passiv", level: "P" },
    { code: "A6", name: "Aktiv", level: "A" },
    { code: "C10", name: "Konstruktiv", level: "C" },
    { code: "NA3", name: "Ej tillämplig", level: "NA" },
  ],
};

function session(
  participantCode: string,
  lesson: Lesson,
  coding: Partial<AgreementSessionInput["coding"]>,
  prompts: number[] = [1, 3, 5],
): AgreementSessionInput {
  return {
    sessionId: `${participantCode}_${lesson}`,
    participantCode,
    lesson,
    prompts,
    coding: { AI: [], R1: [], R2: [], ...coding },
  };
}

// Unless given, every code is taken to sit on a prompt of its own.
const coded = (
  P: number,
  A: number,
  C: number,
  codedPrompts = P + A + C,
): DevelopmentLesson => ({
  state: "coded",
  counts: { P, A, C },
  codedPrompts,
});
const uncoded: DevelopmentLesson = { state: "uncoded" };
const noTranscript: DevelopmentLesson = { state: "noTranscript" };

describe("studentDevelopment", () => {
  it("counts every P, A and C code per lesson and coder, without NA", () => {
    const [student] = studentDevelopment(
      [
        session("7", 2, {
          AI: [
            { message: 1, codes: ["P2", "C10"] },
            { message: 3, codes: ["A6"] },
            { message: 5, codes: ["NA3"] },
          ],
          R1: [{ message: 1, codes: ["P2"] }],
        }),
      ],
      framework,
      null,
    );

    expect(student.participantCode).toBe("7");
    expect(student.lessons.AI).toEqual([
      noTranscript,
      // Message 1 has P2 and C10 and message 3 has A6; message 5 has only NA.
      coded(1, 1, 1, 2),
      noTranscript,
      noTranscript,
    ]);
    expect(student.lessons.R1[1]).toEqual(coded(1, 0, 0));
    expect(student.lessons.R2[1]).toEqual(uncoded);
  });

  it("treats a lesson coded with only NA as coded, with no P, A or C", () => {
    const [student] = studentDevelopment(
      [session("7", 3, { R2: [{ message: 3, codes: ["NA3"] }] })],
      framework,
      null,
    );
    expect(student.lessons.R2[2]).toEqual(coded(0, 0, 0));
  });

  it("ignores codes on messages that are not student prompts", () => {
    const [student] = studentDevelopment(
      [session("7", 2, { R1: [{ message: 2, codes: ["C10"] }] })],
      framework,
      null,
    );
    expect(student.lessons.R1[1]).toEqual(uncoded);
  });

  it("counts a code repeated on one prompt once", () => {
    const [student] = studentDevelopment(
      [
        session("7", 2, {
          R1: [
            { message: 1, codes: ["A6"] },
            { message: 1, codes: ["A6", "C10"] },
          ],
        }),
      ],
      framework,
      null,
    );
    expect(student.lessons.R1[1]).toEqual(coded(0, 1, 1, 1));
  });

  it("shows lesson 1 under the participant's later code", () => {
    const lessonOneCodes: LessonOneCodes = {
      toStudyCode: new Map([["40", "12"]]),
      toLessonOneCode: new Map([["12", "40"]]),
    };
    const students = studentDevelopment(
      [
        session("40", 1, { AI: [{ message: 1, codes: ["P2"] }] }),
        session("12", 2, { AI: [{ message: 1, codes: ["C10"] }] }),
      ],
      framework,
      lessonOneCodes,
    );

    expect(students.map((student) => student.participantCode)).toEqual(["12"]);
    expect(students[0].lessons.AI.slice(0, 2)).toEqual([
      coded(1, 0, 0),
      coded(0, 0, 1),
    ]);
  });

  it("sorts participants by code as numbers", () => {
    const students = studentDevelopment(
      [session("12", 2, {}), session("3", 2, {}), session("7", 2, {})],
      framework,
      null,
    );
    expect(students.map((student) => student.participantCode)).toEqual([
      "3",
      "7",
      "12",
    ]);
  });
});

describe("levelValue", () => {
  it("gives a share or a count", () => {
    const counts = { P: 1, A: 1, C: 2 };
    expect(levelValue(counts, "C", "share")).toBe(0.5);
    expect(levelValue(counts, "C", "count")).toBe(2);
  });

  it("has no share without P, A or C codes", () => {
    expect(levelValue({ P: 0, A: 0, C: 0 }, "P", "share")).toBeNull();
    expect(levelValue({ P: 0, A: 0, C: 0 }, "P", "count")).toBe(0);
  });
});

describe("levelChange", () => {
  it("compares the first and last lessons with a value, skipping gaps", () => {
    const lessons = [uncoded, coded(3, 1, 0), noTranscript, coded(1, 1, 2)];
    expect(levelChange(lessons, "C", "share")).toBe(0.5);
    expect(levelChange(lessons, "P", "count")).toBe(-2);
  });

  it("needs two lessons with a value", () => {
    expect(
      levelChange([coded(1, 0, 0), uncoded, coded(0, 0, 0)], "P", "share"),
    ).toBeNull();
    expect(
      levelChange([coded(1, 0, 0), uncoded, coded(0, 0, 0)], "P", "count"),
    ).toBe(-1);
  });
});
