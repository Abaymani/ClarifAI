import { describe, expect, it } from "vitest";

import type {
  DevelopmentLesson,
  StudentDevelopment,
} from "@/lib/admin/student-development";

import { passiveShare } from "./passive-share";

const coded = (P: number, A: number, C: number): DevelopmentLesson => ({
  state: "coded",
  counts: { P, A, C },
});
const uncoded: DevelopmentLesson = { state: "uncoded" };
const none: DevelopmentLesson = { state: "noTranscript" };

function student(
  participantCode: string,
  ai: DevelopmentLesson[],
): StudentDevelopment {
  // Researcher coding is set apart from the AI's, so a test fails if it is used.
  const researcher = [
    coded(9, 0, 0),
    coded(9, 0, 0),
    coded(9, 0, 0),
    coded(9, 0, 0),
  ];
  return {
    participantCode,
    lessons: { AI: ai, R1: researcher, R2: researcher },
  };
}

// Student 1 prompts a lot and is mostly passive; student 2 prompts little.
const students = [
  student("1", [
    coded(8, 2, 0),
    coded(6, 2, 2),
    coded(4, 4, 2),
    coded(2, 4, 4),
  ]),
  student("2", [coded(0, 1, 1), uncoded, coded(0, 1, 1), none]),
  // Only NA codes, so no share in lesson 1, and no AI coding after it.
  student("3", [coded(0, 0, 0), none, none, none]),
];

describe("passiveShare", () => {
  it("averages each student's share per lesson", () => {
    const result = passiveShare(students, "mean", "all");

    expect(result.lessons.map((lesson) => lesson.students)).toEqual([
      2, 1, 2, 1,
    ]);
    // Lesson 1: (80 % + 0 %) / 2. Student 3 has no P, A or C code.
    expect(result.lessons[0].share).toBeCloseTo(0.4);
    expect(result.lessons[0].studentShares).toEqual([0.8, 0]);
    expect(result.lessons[0].codes).toBe(12);
    // Lesson 2: only student 1, 6 of 10.
    expect(result.lessons[1].share).toBeCloseTo(0.6);
  });

  it("pools all codes when asked, so students with more codes weigh more", () => {
    const result = passiveShare(students, "pooled", "all");
    // Lesson 1: 8 P of 12 codes.
    expect(result.lessons[0].share).toBeCloseTo(8 / 12);
  });

  it("pools each student's two lessons before and after the reflections", () => {
    const result = passiveShare(students, "mean", "all");

    // Pre: student 1 has 14 P of 20, student 2 has 0 of 2.
    expect(result.pre.studentShares).toEqual([0.7, 0]);
    expect(result.pre.share).toBeCloseTo(0.35);
    expect(result.pre.codes).toBe(22);
    // Post: student 1 has 6 P of 20, student 2 has 0 of 2.
    expect(result.post.share).toBeCloseTo(0.15);
    expect(result.change).toBeCloseTo(-0.2);

    const pooled = passiveShare(students, "pooled", "all");
    expect(pooled.pre.share).toBeCloseTo(14 / 22);
    expect(pooled.post.share).toBeCloseTo(6 / 22);
  });

  it("can keep only students with AI coding in all four lessons", () => {
    const result = passiveShare(students, "mean", "allFour");

    expect(result.lessons.map((lesson) => lesson.students)).toEqual([
      1, 1, 1, 1,
    ]);
    expect(result.pre.share).toBeCloseTo(0.7);
    expect(result.post.share).toBeCloseTo(0.3);
  });

  it("has no share or change without P, A or C codes", () => {
    const result = passiveShare([students[2]], "mean", "all");

    expect(result.lessons[0]).toEqual({
      share: null,
      students: 0,
      codes: 0,
      studentShares: [],
    });
    expect(result.change).toBeNull();
  });
});
