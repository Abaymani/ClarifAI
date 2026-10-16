import { beforeAll, describe, expect, test } from "vitest";

import {
  listResearcherCoding,
  savePromptCoding,
  saveSequenceCoding,
} from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const session = { sessionId: "955_2", researcherId: "R1" as const };

beforeAll(async () => {
  await getDb()
    .collection("sessions")
    .doc("955_2")
    .set({
      participantCode: "955",
      lesson: 2,
      status: "completed",
      transcriptSubmission: "transcript",
      transcript: {
        source: {
          submittedLink: "https://gemini.google.com/share/abc123def456",
          shareUrl: "https://gemini.google.com/share/abc123def456",
          title: "Kodning",
          model: "Gemini",
          sharedAt: null,
        },
        retrievedAt: "2026-10-16T00:00:00.000Z",
        parserVersion: 2,
        warnings: [],
        messages: [
          { index: 1, role: "student", text: "Jag testade lysdioden." },
          { index: 2, role: "gemini", text: "Vad observerade du?" },
          { index: 3, role: "student", text: "Den blinkar varannan sekund." },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
});

async function stored(kind: "prompt" | "sequence") {
  return (await listResearcherCoding("955_2")).R1.filter(
    (entry) => entry.kind === kind,
  );
}

describe("saving researcher coding field by field", () => {
  test("a prompt keeps its note when codes are saved, and its codes when the note is saved", async () => {
    await savePromptCoding({
      ...session,
      message: 1,
      note: "Första",
      codes: ["A6"],
    });
    await savePromptCoding({ ...session, message: 1, codes: ["A6", "C2"] });
    expect(await stored("prompt")).toEqual([
      expect.objectContaining({ note: "Första", codes: ["A6", "C2"] }),
    ]);

    await savePromptCoding({ ...session, message: 1, note: "Andra" });
    expect(await stored("prompt")).toEqual([
      expect.objectContaining({ note: "Andra", codes: ["A6", "C2"] }),
    ]);

    await savePromptCoding({ ...session, message: 1, codes: [] });
    expect(await stored("prompt")).toEqual([
      expect.objectContaining({ note: "Andra", codes: [] }),
    ]);

    // Nothing left: the entry is removed.
    await savePromptCoding({ ...session, message: 1, note: "" });
    expect(await stored("prompt")).toEqual([]);
  });

  test("a sequence is stored with its first code, keeps it through range changes, and is removed when emptied", async () => {
    const id = "sequence-fields-1";
    await saveSequenceCoding({
      ...session,
      id,
      firstMessage: 1,
      lastMessage: 3,
      codes: ["S7"],
    });
    await saveSequenceCoding({
      ...session,
      id,
      firstMessage: 1,
      lastMessage: 2,
    });
    expect(await stored("sequence")).toEqual([
      expect.objectContaining({
        firstMessage: 1,
        lastMessage: 2,
        note: "",
        codes: ["S7"],
      }),
    ]);

    const emptied = await saveSequenceCoding({
      ...session,
      id,
      firstMessage: 1,
      lastMessage: 2,
      codes: [],
    });
    expect(emptied.codes).toEqual([]);
    expect(await stored("sequence")).toEqual([]);
  });
});
