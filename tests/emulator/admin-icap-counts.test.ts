import { describe, expect, test } from "vitest";

import { listAdminOverview } from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const run = {
  frameworkVersion: "test",
  frameworkStatus: "ACTIVE",
  analyser: "fake",
  model: null,
  reasoningEffort: null,
  createdAt: "2026-10-14T00:00:00.000Z",
  durationMs: 1,
  usage: null,
};

function coded(code: string) {
  return { code, excerpt: "x", justification: "x" };
}

function sequence(pattern: string) {
  return {
    pattern,
    firstMessage: 1,
    lastMessage: 3,
    excerptMessage: 1,
    excerpt: "x",
    justification: "x",
  };
}

describe("AI coding per ICAP level in the overview", () => {
  test("counts the stored AI coding with the framework's levels", async () => {
    const db = getDb();
    const base = {
      participantCode: "954",
      status: "completed",
      transcriptSubmission: "transcript",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db
      .collection("sessions")
      .doc("954_2")
      .set({
        ...base,
        lesson: 2,
        analysis: {
          ...run,
          prompts: [
            { message: 1, codes: [coded("P2"), coded("C10")], note: null },
            { message: 3, codes: [coded("A6")], note: null },
            { message: 5, codes: [coded("NA3")], note: null },
            { message: 7, codes: [], note: "För lite sammanhang" },
          ],
          sequences: [sequence("S7"), sequence("S6")],
        },
      });
    await db
      .collection("sessions")
      .doc("954_3")
      .set({ ...base, lesson: 3 });

    const participant = (await listAdminOverview()).find(
      (entry) => entry.participantCode === "954",
    );
    // Sequences, S7 included, are not counted.
    expect(participant?.sessions[2]?.aiCodeCounts).toEqual({
      P: 1,
      A: 1,
      C: 1,
    });
    expect(participant?.sessions[3]?.aiCodeCounts).toBeUndefined();
  });
});
