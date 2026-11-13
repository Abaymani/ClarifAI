import {
  CollectionReference,
  Query,
  DocumentReference,
  Firestore,
  WriteBatch,
} from "firebase-admin/firestore";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  loadAgreementInputs,
  savePromptCoding,
  tryFrameworkChanges,
} from "@/lib/admin/store";
import { getDb } from "@/lib/firebase/admin";

const transcript = {
  source: {
    submittedLink: "https://gemini.google.com/share/abc123def456",
    shareUrl: "https://gemini.google.com/share/abc123def456",
    title: "Framework changes test",
    model: "Gemini",
    sharedAt: null,
  },
  retrievedAt: "2026-11-09T00:00:00.000Z",
  parserVersion: 2,
  warnings: [],
  messages: [
    { index: 1, role: "student", text: "Vad ska jag välja?" },
    { index: 2, role: "gemini", text: "Det beror på." },
    { index: 3, role: "student", text: "Jag väljer motståndet." },
  ],
};

function analysis(codes: string[]) {
  return {
    frameworkVersion: "test",
    frameworkStatus: "ACTIVE",
    analyser: "fake",
    model: null,
    reasoningEffort: null,
    createdAt: "2026-11-09T00:00:00.000Z",
    durationMs: 1,
    usage: null,
    prompts: [
      {
        message: 1,
        codes: codes.map((code) => ({
          code,
          excerpt: "x",
          justification: "x",
        })),
        note: null,
      },
      { message: 3, codes: [], note: "För lite sammanhang" },
    ],
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

async function readSeeded() {
  const db = getDb();
  const sessions = await db.getAll(
    db.doc("sessions/991_2"),
    db.doc("sessions/992_2"),
  );
  const entries = await db.collectionGroup("entries").get();
  return {
    sessions: sessions.map((snapshot) => snapshot.data()),
    entries: entries.docs
      .filter((doc) => /^sessions\/99[12]_2\//.test(doc.ref.path))
      .map((doc) => [doc.ref.path, doc.data()]),
  };
}

describe("trying framework changes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("only reads, and leaves the coding exactly as it was", async () => {
    const db = getDb();
    for (const [id, aiCodes] of [
      ["991_2", ["P1"]],
      ["992_2", ["C3"]],
    ] as const) {
      await db
        .collection("sessions")
        .doc(id)
        .set({
          participantCode: id.split("_")[0],
          lesson: 2,
          status: "completed",
          transcriptSubmission: "transcript",
          transcript,
          analysis: analysis([...aiCodes]),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }
    await savePromptCoding({
      sessionId: "991_2",
      researcherId: "R1",
      message: 1,
      codes: ["A2"],
    });
    await savePromptCoding({
      sessionId: "991_2",
      researcherId: "R2",
      message: 1,
      codes: ["P1"],
    });
    await savePromptCoding({
      sessionId: "992_2",
      researcherId: "R1",
      message: 1,
      codes: ["C3", "C9"],
    });
    const before = await readSeeded();
    const writes = watchWrites();

    const result = await tryFrameworkChanges([
      { kind: "merge", codes: ["P1", "A2"], level: "P" },
      { kind: "delete", code: "C9" },
    ]);
    const refused = await tryFrameworkChanges([
      { kind: "delete", code: "NA1" },
    ]);

    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(await readSeeded()).toEqual(before);
    // The watch does see writes: this one is the test's own.
    await db.doc("frameworkChangesTest/control").set({ at: new Date() });
    expect(writes[0]).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(refused).toEqual({
      ok: false,
      problem: "NA1 är ingen P-, A- eller C-kod i ramverket.",
    });
  });

  test("works on inputs it is given without reading the database (DL-081)", async () => {
    const inputs = await loadAgreementInputs();
    const reads = [
      vi.spyOn(Query.prototype, "get"),
      vi.spyOn(DocumentReference.prototype, "get"),
      vi.spyOn(Firestore.prototype, "getAll"),
    ];

    const result = await tryFrameworkChanges(
      [{ kind: "delete", code: "C9" }],
      inputs,
    );

    expect(result.ok).toBe(true);
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });
});
