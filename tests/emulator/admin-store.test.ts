import { describe, expect, test } from "vitest";

import {
  deleteSequenceCoding,
  listAdminOverview,
  listResearcherCoding,
  savePromptCoding,
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

describe("admin store", () => {
  test("builds a participant-by-lesson overview", async () => {
    const db = getDb();
    await db.collection("participants").doc("951").set({ code: "951" });
    await db.collection("sessions").doc("951_1").set({
      participantCode: "951",
      lesson: 1,
      status: "completed",
      transcriptSubmission: "transcript",
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
    await db
      .doc("sessions/951_1/researcherCoding/R1/entries/prompt-1")
      .set({ kind: "prompt" });

    const participant = (await listAdminOverview()).find(
      (entry) => entry.participantCode === "951",
    );
    expect(participant?.sessions[1]?.state).toBe("completed");
    expect(participant?.sessions[1]?.codedBy).toEqual(["R1"]);
    expect(participant?.sessions[2]?.state).toBe("started");
    expect(participant?.sessions[2]?.codedBy).toEqual([]);
    expect(participant?.sessions[3]).toBeUndefined();
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
});
