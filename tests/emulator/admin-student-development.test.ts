import {
  CollectionReference,
  DocumentReference,
  Firestore,
  WriteBatch,
} from "firebase-admin/firestore";
import { afterEach, describe, expect, test, vi } from "vitest";

import { loadStudentDevelopment, savePromptCoding } from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const transcript = {
  source: {
    submittedLink: "https://gemini.google.com/share/abc123def456",
    shareUrl: "https://gemini.google.com/share/abc123def456",
    title: "Development test",
    model: "Gemini",
    sharedAt: null,
  },
  retrievedAt: "2026-11-10T00:00:00.000Z",
  parserVersion: 2,
  warnings: [],
  messages: [
    { index: 1, role: "student", text: "Vad ska jag välja?" },
    { index: 2, role: "gemini", text: "Det beror på." },
    { index: 3, role: "student", text: "Jag väljer motståndet." },
  ],
};

function analysis(codes: string[][]) {
  return {
    frameworkVersion: "test",
    frameworkStatus: "ACTIVE",
    analyser: "fake",
    model: null,
    reasoningEffort: null,
    createdAt: "2026-11-10T00:00:00.000Z",
    durationMs: 1,
    usage: null,
    prompts: codes.map((prompt, index) => ({
      message: index * 2 + 1,
      codes: prompt.map((code) => ({ code, excerpt: "x", justification: "x" })),
      note: null,
    })),
    sequences: [],
  };
}

// Every way the Admin SDK can write, so a single call would show.
function watchWrites() {
  return [
    vi.spyOn(DocumentReference.prototype, "set"),
    vi.spyOn(DocumentReference.prototype, "update"),
    vi.spyOn(DocumentReference.prototype, "delete"),
    vi.spyOn(DocumentReference.prototype, "create"),
    vi.spyOn(CollectionReference.prototype, "add"),
    vi.spyOn(WriteBatch.prototype, "commit"),
    vi.spyOn(Firestore.prototype, "runTransaction"),
    vi.spyOn(Firestore.prototype, "bulkWriter"),
    vi.spyOn(Firestore.prototype, "recursiveDelete"),
  ];
}

const SESSION_IDS = ["993_2", "993_3", "994_2"];

async function readSeeded() {
  const db = getDb();
  const sessions = await db.getAll(
    ...SESSION_IDS.map((id) => db.doc(`sessions/${id}`)),
  );
  const entries = await db.collectionGroup("entries").get();
  return {
    sessions: sessions.map((snapshot) => snapshot.data()),
    entries: entries.docs
      .filter((doc) => /^sessions\/99[34]_[23]\//.test(doc.ref.path))
      .map((doc) => [doc.ref.path, doc.data()]),
  };
}

describe("student development", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("counts each coder's codes and leaves everything as it was", async () => {
    const db = getDb();
    const seeds: [string, string[][]][] = [
      ["993_2", [["P1"], ["P1", "C3"]]],
      ["993_3", [["A2"], ["C3"]]],
      ["994_2", [["NA1"]]],
    ];
    for (const [id, aiCodes] of seeds) {
      const [participantCode, lesson] = id.split("_");
      await db
        .collection("sessions")
        .doc(id)
        .set({
          participantCode,
          lesson: Number(lesson),
          status: "completed",
          transcriptSubmission: "transcript",
          transcript,
          analysis: analysis(aiCodes),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }
    await savePromptCoding({
      sessionId: "993_2",
      researcherId: "R1",
      message: 1,
      codes: ["A2"],
    });
    await savePromptCoding({
      sessionId: "993_3",
      researcherId: "R2",
      message: 3,
      codes: ["C3", "C9"],
    });
    const before = await readSeeded();
    const writes = watchWrites();

    const students = await loadStudentDevelopment();

    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(await readSeeded()).toEqual(before);
    // The watch does see writes: this one is the test's own.
    await db.doc("studentDevelopmentTest/control").set({ at: new Date() });
    expect(writes[0]).toHaveBeenCalledTimes(1);

    const first = students.find((student) => student.participantCode === "993");
    expect(first?.lessons.AI).toEqual([
      { state: "noTranscript" },
      { state: "coded", counts: { P: 2, A: 0, C: 1 } },
      { state: "coded", counts: { P: 0, A: 1, C: 1 } },
      { state: "noTranscript" },
    ]);
    expect(first?.lessons.R1.slice(1, 3)).toEqual([
      { state: "coded", counts: { P: 0, A: 1, C: 0 } },
      { state: "uncoded" },
    ]);
    expect(first?.lessons.R2.slice(1, 3)).toEqual([
      { state: "uncoded" },
      { state: "coded", counts: { P: 0, A: 0, C: 2 } },
    ]);
    const second = students.find(
      (student) => student.participantCode === "994",
    );
    expect(second?.lessons.AI[1]).toEqual({
      state: "coded",
      counts: { P: 0, A: 0, C: 0 },
    });
  });
});
