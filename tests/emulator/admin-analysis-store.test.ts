import { describe, expect, test } from "vitest";

import {
  adminLessonAnalysisStore,
  requestAdminLessonAnalysis,
} from "@/lib/admin/analysis";
import { sampleTranscript } from "@/lib/analysis/test-fixtures";
import type {
  StoredCoding,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import { getDb } from "@/lib/firebase/admin";

const analysisRun = {
  frameworkVersion: "TEST-fixture",
  frameworkStatus: "TEST",
  analyser: "fake" as const,
  model: null,
  reasoningEffort: null,
  createdAt: "2026-10-12T10:00:00.000Z",
  durationMs: 10,
  usage: null,
};

const coding: StoredCoding = {
  ...analysisRun,
  prompts: [
    {
      message: 1,
      codes: [{ code: "C5", excerpt: "Jag tror", justification: "Test" }],
      note: null,
    },
  ],
  sequences: [],
};

const questions: StoredReflectionQuestions = {
  ...analysisRun,
  outcome: "insufficient_evidence",
  items: [
    {
      id: "q1",
      group: "R0",
      groupKind: "general",
      basedOn: null,
      excerpt: null,
      intro: "Inledning.",
      questions: ["Fråga?"],
      tip: null,
      template: { intro: "Inledning.", questions: ["Fråga?"] },
    },
  ],
};

async function completedLesson(code: string, lesson: 1 | 2 | 4) {
  const now = new Date("2026-10-12T09:00:00.000Z");
  const data = {
    participantCode: code,
    lesson,
    status: "completed",
    transcriptSubmission: "transcript",
    transcript: sampleTranscript(),
    transcriptConfirmedAt: now,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
    errorCode: null,
    reflectionResponses: {
      submittedAt: now,
      items: [{ itemId: "legacy", answer: "Studentdata", agreement: null }],
    },
    studentMarker: "must-stay-identical",
  };
  const ref = getDb().collection("sessions").doc(`${code}_${lesson}`);
  await ref.set(data);
  return { ref, before: (await ref.get()).data()! };
}

describe("admin lesson analysis store", () => {
  test("allows only one researcher to claim a participant and lesson", async () => {
    const { ref, before } = await completedLesson("971", 1);

    const results = await Promise.all([
      requestAdminLessonAnalysis({
        sessionId: "971_1",
        researcherId: "R1",
        attemptId: "attempt-r1",
      }),
      requestAdminLessonAnalysis({
        sessionId: "971_1",
        researcherId: "R2",
        attemptId: "attempt-r2",
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "ALREADY_REQUESTED" },
    ]);
    const after = (await ref.get()).data()!;
    expect(without(after, "adminAnalysisRequest")).toEqual(before);
  });

  test("adds results without changing any submitted student field", async () => {
    const { ref, before } = await completedLesson("972", 4);
    const requested = await requestAdminLessonAnalysis({
      sessionId: "972_4",
      researcherId: "R2",
      attemptId: "analysis-once",
    });
    expect(requested).toMatchObject({ ok: true });

    expect(
      await adminLessonAnalysisStore.load("972_4", "analysis-once"),
    ).toMatchObject({
      transcript: { messages: expect.any(Array) },
      coding: null,
    });
    expect(
      await adminLessonAnalysisStore.saveCoding(
        "972_4",
        "analysis-once",
        coding,
      ),
    ).toBe(true);
    expect(
      await adminLessonAnalysisStore.saveQuestions(
        "972_4",
        "analysis-once",
        questions,
      ),
    ).toBe(true);

    const after = (await ref.get()).data()!;
    expect(
      without(after, "adminAnalysisRequest", "analysis", "reflectionQuestions"),
    ).toEqual(before);
    expect(after.analysis).toEqual(coding);
    expect(after.reflectionQuestions).toEqual(questions);
    expect(after.adminAnalysisRequest).toMatchObject({
      status: "completed",
      requestedBy: "R2",
      errorCode: null,
    });

    expect(
      await adminLessonAnalysisStore.saveCoding("972_4", "analysis-once", {
        ...coding,
        prompts: [],
      }),
    ).toBe(false);
    expect((await ref.get()).data()?.analysis).toEqual(coding);
  });

  test("rejects other lessons, incomplete transcripts, and existing results", async () => {
    await completedLesson("973", 2);
    expect(
      await requestAdminLessonAnalysis({
        sessionId: "973_2",
        researcherId: "R1",
        attemptId: "wrong-lesson",
      }),
    ).toEqual({ ok: false, reason: "NOT_ELIGIBLE" });

    const incomplete = await completedLesson("974", 1);
    await incomplete.ref.update({ transcriptConfirmedAt: null });
    expect(
      await requestAdminLessonAnalysis({
        sessionId: "974_1",
        researcherId: "R1",
        attemptId: "not-ready",
      }),
    ).toEqual({ ok: false, reason: "NO_TRANSCRIPT" });

    const existing = await completedLesson("975", 4);
    await existing.ref.update({ analysis: coding });
    expect(
      await requestAdminLessonAnalysis({
        sessionId: "975_4",
        researcherId: "R2",
        attemptId: "would-overwrite",
      }),
    ).toEqual({ ok: false, reason: "ALREADY_REQUESTED" });
  });
});

function without(data: Record<string, unknown>, ...keys: string[]) {
  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !keys.includes(key)),
  );
}
