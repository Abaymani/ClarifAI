import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, test } from "vitest";

import {
  loadCoderAgreement,
  runCoderAgreement,
  savePromptCoding,
  saveSequenceCoding,
} from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const transcript = {
  source: {
    submittedLink: "https://gemini.google.com/share/abc123def456",
    shareUrl: "https://gemini.google.com/share/abc123def456",
    title: "Agreement test",
    model: "Gemini",
    sharedAt: null,
  },
  retrievedAt: "2026-11-09T00:00:00.000Z",
  parserVersion: 2,
  warnings: [],
  messages: [
    { index: 1, role: "student", text: "Hur kopplar jag lysdioden?" },
    { index: 2, role: "gemini", text: "Med ett motstånd i serie." },
    { index: 3, role: "student", text: "Jag tror att motståndet skyddar den." },
    { index: 4, role: "gemini", text: "Precis." },
    { index: 5, role: "student", text: "Tack!" },
  ],
};

const run = {
  frameworkVersion: "test",
  frameworkStatus: "ACTIVE",
  analyser: "fake",
  model: null,
  reasoningEffort: null,
  createdAt: "2026-11-09T00:00:00.000Z",
  durationMs: 1,
  usage: null,
};

function coded(code: string) {
  return { code, excerpt: "x", justification: "x" };
}

const latest = () => getDb().collection("coderAgreement").doc("latest");

describe("coder agreement in the store", () => {
  test("reads nothing before the first run or from an unreadable result", async () => {
    await latest().delete();
    expect(await loadCoderAgreement()).toBeNull();

    await latest().set({
      calculatedAt: Timestamp.now(),
      calculatedBy: "R1",
      result: JSON.stringify({ transcripts: 3 }),
    });
    expect(await loadCoderAgreement()).toBeNull();
  });

  test("compares the stored prompt coding of every transcript and keeps the latest result", async () => {
    const db = getDb();
    const base = {
      status: "completed",
      transcriptSubmission: "transcript",
      transcript,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db
      .collection("sessions")
      .doc("961_2")
      .set({
        ...base,
        participantCode: "961",
        lesson: 2,
        analysis: {
          ...run,
          prompts: [
            { message: 1, codes: [coded("P1")], note: null },
            { message: 3, codes: [], note: "För lite sammanhang" },
            { message: 5, codes: [coded("NA2")], note: null },
          ],
          sequences: [],
        },
      });
    await db
      .collection("sessions")
      .doc("961_3")
      .set({ ...base, participantCode: "961", lesson: 3 });
    await db.collection("sessions").doc("962_2").set({
      participantCode: "962",
      lesson: 2,
      status: "completed",
      transcriptSubmission: "no_gemini",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await savePromptCoding({
      sessionId: "961_2",
      researcherId: "R1",
      message: 1,
      codes: ["P1"],
    });
    await savePromptCoding({
      sessionId: "961_2",
      researcherId: "R1",
      message: 3,
      codes: ["NA1", "A2"],
    });
    await savePromptCoding({
      sessionId: "961_2",
      researcherId: "R2",
      message: 5,
      codes: ["NA3"],
    });
    // Reflection comments share the `entries` collection group with coding.
    await db
      .doc("sessions/961_2/researcherReflectionComments/R1/entries/q1")
      .set({
        researcherId: "R1",
        itemId: "q1",
        comment: "Bra fråga",
        updatedAt: new Date(),
      });
    // Neither a note without codes nor a sequence code makes a transcript coded.
    await savePromptCoding({
      sessionId: "961_3",
      researcherId: "R2",
      message: 1,
      note: "Bara en anteckning",
    });
    await saveSequenceCoding({
      sessionId: "961_3",
      researcherId: "R1",
      id: "sequence-agreement-1",
      firstMessage: 1,
      lastMessage: 3,
      codes: ["S1"],
    });

    const now = new Date("2026-11-09T13:32:00.000Z");
    const result = await runCoderAgreement("R2", now);

    expect(
      result.transcripts.filter((row) =>
        ["961", "962"].includes(row.participantCode),
      ),
    ).toEqual([
      {
        sessionId: "961_2",
        participantCode: "961",
        lesson: 2,
        prompts: 3,
        coders: ["R1", "R2", "AI"],
        // Armin: P1, A2, none. Frida: none (NA3 only). AI: P1, none, none (NA2).
        differing: [
          { pair: "R1-R2", prompts: 2 },
          { pair: "AI-R1", prompts: 1 },
          { pair: "AI-R2", prompts: 1 },
        ],
      },
    ]);
    expect(result).toMatchObject({
      calculatedAt: "2026-11-09T13:32:00.000Z",
      calculatedBy: "R2",
    });
    expect(result.variants).toHaveLength(10);
    expect(await loadCoderAgreement()).toEqual(result);
  });
});
