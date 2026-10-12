import { describe, expect, test } from "vitest";

import {
  deleteSequenceCoding,
  listAdminOverview,
  listReflectionComments,
  listResearcherCoding,
  savePromptCoding,
  saveReflectionComment,
  saveSequenceCoding,
} from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const transcript = {
  source: {
    submittedLink: "https://gemini.google.com/share/abc123def456",
    shareUrl: "https://gemini.google.com/share/abc123def456",
    title: "Admin test",
    model: "Gemini",
    sharedAt: null,
  },
  retrievedAt: "2026-10-05T00:00:00.000Z",
  parserVersion: 2,
  warnings: [],
  messages: [
    { index: 1, role: "student", text: "Jag testade lysdioden." },
    { index: 2, role: "gemini", text: "Vad observerade du?" },
    { index: 3, role: "student", text: "Den blinkar varannan sekund." },
  ],
};

const assessmentReflectionQuestions = {
  frameworkVersion: "test",
  frameworkStatus: "ACTIVE",
  analyser: "fake",
  model: null,
  reasoningEffort: null,
  createdAt: "2026-10-09T00:00:00.000Z",
  durationMs: 1,
  usage: null,
  outcome: "observations",
  items: [
    {
      id: "q1",
      group: "F11",
      groupKind: "reinforce",
      basedOn: {
        kind: "prompt",
        code: "A6",
        firstMessage: 1,
        lastMessage: 1,
      },
      excerpt: { message: 1, text: "Jag testade lysdioden." },
      intro: "Du beskrev försöket noggrant.",
      questions: ["Vad gjorde beskrivningen tydlig?"],
      tip: null,
      template: {
        intro: "Du beskrev försöket noggrant.",
        questions: ["Vad gjorde beskrivningen tydlig?"],
      },
    },
    {
      id: "q2",
      group: "R0",
      groupKind: "general",
      basedOn: null,
      excerpt: null,
      intro: "Reflektera över arbetet.",
      questions: ["Vad tar du med dig?"],
      tip: null,
      template: {
        intro: "Reflektera över arbetet.",
        questions: ["Vad tar du med dig?"],
      },
    },
  ],
};

describe("admin store", () => {
  test("builds a participant-by-lesson overview", async () => {
    const db = getDb();
    await db.collection("participants").doc("951").set({ code: "951" });
    await db
      .collection("sessions")
      .doc("951_1")
      .set({
        participantCode: "951",
        lesson: 1,
        status: "completed",
        transcriptSubmission: "transcript",
        reflectionQuestions: assessmentReflectionQuestions,
        reflectionResponses: {
          submittedAt: new Date(),
          items: [
            { itemId: "q1", answer: "Det stämde.", agreement: "yes" },
            { itemId: "q2", answer: "Jag lärde mig mycket.", agreement: null },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await db.collection("sessions").doc("951_2").set({
      participantCode: "951",
      lesson: 2,
      status: "processing",
      transcriptSubmission: "transcript",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.collection("sessions").doc("951_4").set({
      participantCode: "951",
      lesson: 4,
      status: "awaiting_reflection",
      transcriptSubmission: "transcript",
      reflectionQuestions: assessmentReflectionQuestions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db
      .doc("sessions/951_1/researcherCoding/R1/entries/prompt-1")
      .set({ kind: "prompt" });

    const participant = (await listAdminOverview()).find(
      (entry) => entry.participantCode === "951",
    );
    expect(participant?.sessions[1]?.state).toBe("completed");
    expect(participant?.sessions[1]?.codedBy).toEqual(["R1"]);
    expect(participant?.sessions[1]?.reflectionAssessment).toEqual({
      state: "submitted",
      agreements: ["yes"],
    });
    expect(participant?.sessions[2]?.state).toBe("started");
    expect(participant?.sessions[2]?.codedBy).toEqual([]);
    expect(participant?.sessions[2]?.reflectionAssessment).toEqual({
      state: "unavailable",
    });
    expect(participant?.sessions[3]).toBeUndefined();
    expect(participant?.sessions[4]?.reflectionAssessment).toEqual({
      state: "not_submitted",
    });
  });

  test("keeps prompt and sequence coding separate for each researcher", async () => {
    const db = getDb();
    await db.collection("sessions").doc("952_2").set({
      participantCode: "952",
      lesson: 2,
      status: "completed",
      transcriptSubmission: "transcript",
      transcript,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const participantSubmission = (
      await db.collection("sessions").doc("952_2").get()
    ).data();

    await savePromptCoding({
      sessionId: "952_2",
      researcherId: "R1",
      message: 1,
      note: "R1 note",
      codes: ["A6"],
    });
    await savePromptCoding({
      sessionId: "952_2",
      researcherId: "R2",
      message: 1,
      note: "R2 note",
      codes: ["C2"],
    });
    const sequence = await saveSequenceCoding({
      sessionId: "952_2",
      researcherId: "R1",
      id: "sequence-12345678",
      firstMessage: 1,
      lastMessage: 3,
      note: "R1 sequence",
      codes: ["S1"],
    });

    const coding = await listResearcherCoding("952_2");
    expect(coding.R1).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "prompt",
          note: "R1 note",
          frameworkVersion: "2026-10-01.3",
        }),
        expect.objectContaining({ kind: "sequence", codes: ["S1"] }),
      ]),
    );
    expect(coding.R2).toEqual([
      expect.objectContaining({ kind: "prompt", note: "R2 note" }),
    ]);
    expect((await db.collection("sessions").doc("952_2").get()).data()).toEqual(
      participantSubmission,
    );

    await deleteSequenceCoding({
      sessionId: "952_2",
      researcherId: "R1",
      id: sequence.id,
    });
    expect((await listResearcherCoding("952_2")).R1).toEqual([
      expect.objectContaining({ kind: "prompt" }),
    ]);
    expect((await db.collection("sessions").doc("952_2").get()).data()).toEqual(
      participantSubmission,
    );
  });

  test("stores researcher reflection comments separately without changing the session record", async () => {
    const db = getDb();
    await db
      .collection("sessions")
      .doc("953_2")
      .set({
        participantCode: "953",
        lesson: 2,
        status: "completed",
        transcriptSubmission: "transcript",
        transcript,
        reflectionQuestions: {
          frameworkVersion: "test",
          frameworkStatus: "ACTIVE",
          analyser: "fake",
          model: null,
          reasoningEffort: null,
          createdAt: "2026-10-09T00:00:00.000Z",
          durationMs: 1,
          usage: null,
          outcome: "observations",
          items: [
            {
              id: "q1",
              group: "F11",
              groupKind: "reinforce",
              basedOn: {
                kind: "prompt",
                code: "A6",
                firstMessage: 1,
                lastMessage: 1,
              },
              excerpt: { message: 1, text: "Jag testade lysdioden." },
              intro: "Du beskrev försöket noggrant.",
              questions: ["Vad gjorde beskrivningen tydlig?"],
              tip: null,
              template: {
                intro: "Du beskrev [försöket] noggrant.",
                questions: ["Vad gjorde [beskrivningen] tydlig?"],
              },
            },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const sessionBefore = (
      await db.collection("sessions").doc("953_2").get()
    ).data();

    await saveReflectionComment({
      sessionId: "953_2",
      researcherId: "R1",
      itemId: "q1",
      comment: "Armins kommentar",
    });
    await saveReflectionComment({
      sessionId: "953_2",
      researcherId: "R2",
      itemId: "q1",
      comment: "Fridas kommentar",
    });

    const comments = await listReflectionComments("953_2");
    expect(comments.R1).toEqual([
      expect.objectContaining({
        itemId: "q1",
        researcherId: "R1",
        comment: "Armins kommentar",
      }),
    ]);
    expect(comments.R2).toEqual([
      expect.objectContaining({
        itemId: "q1",
        researcherId: "R2",
        comment: "Fridas kommentar",
      }),
    ]);
    expect((await db.collection("sessions").doc("953_2").get()).data()).toEqual(
      sessionBefore,
    );
  });
});
