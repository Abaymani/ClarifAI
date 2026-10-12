import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  GeoPoint,
  getFirestore,
  Timestamp,
} from "firebase-admin/firestore";
import { afterAll, beforeEach, describe, expect, test } from "vitest";

import {
  collectionCounts,
  parseNdjson,
  readAllDocuments,
  toNdjson,
  writeDocuments,
} from "@/lib/backup/firestore-backup";

// A project of its own in the emulator, so documents from other test files never
// show up in a backup of everything.
const PROJECT = "demo-backup-test";
// As in getAdminApp: no cloud metadata server to probe locally.
process.env.METADATA_SERVER_DETECTION ??= "none";
const db = getFirestore(initializeApp({ projectId: PROJECT }, "backup-test"));

async function clearEmulator(): Promise<void> {
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: "DELETE" },
  );
  expect(response.ok).toBe(true);
}

async function seed(): Promise<void> {
  await db.doc("participants/7").set({
    code: "7",
    pin: "1234",
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: Timestamp.fromMillis(1_790_000_000_123),
  });
  await db.doc("sessions/7_2").set({
    status: "completed",
    lesson: 2,
    transcript: {
      messages: [{ index: 1, role: "student", text: "Hej" }],
      warnings: [],
    },
    analysisFailures: [
      { errorCode: "S2-OPENAI", at: new Timestamp(1_790_000_000, 456_000_000) },
    ],
  });
  // As in the admin portal: the parents R1 and R2 are never created themselves.
  await db.doc("sessions/7_2/researcherCoding/R1/entries/a").set({
    researcherId: "R1",
    code: "P3",
  });
  await db.doc("sessions/7_2/researcherCoding/R2/entries/b").set({
    researcherId: "R2",
    code: "C7",
  });
  await db.doc("misc/types").set({
    where: new GeoPoint(59.33, 18.07),
    raw: Buffer.from([0, 1, 254, 255]),
    link: db.doc("sessions/7_2"),
    embedding: FieldValue.vector([0.5, 1, -2]),
    notANumber: NaN,
    infinite: Infinity,
    marked: { __firestore: "not a type" },
  });
}

beforeEach(clearEmulator);
afterAll(clearEmulator);

describe("readAllDocuments", () => {
  test("reaches documents below parents that do not exist", async () => {
    await seed();

    const documents = await readAllDocuments(db);

    expect(documents.map((document) => document.path)).toEqual([
      "misc/types",
      "participants/7",
      "sessions/7_2",
      "sessions/7_2/researcherCoding/R1/entries/a",
      "sessions/7_2/researcherCoding/R2/entries/b",
    ]);
    expect(collectionCounts(documents)).toEqual({
      misc: 1,
      participants: 1,
      sessions: 1,
      "sessions/*/researcherCoding/*/entries": 2,
    });
    // The plain way of reading a collection misses the researchers' coding.
    expect(
      (await db.collection("sessions/7_2/researcherCoding").get()).size,
    ).toBe(0);
  });
});

describe("writeDocuments", () => {
  test("restores a backup exactly", async () => {
    await seed();
    const backup = toNdjson(await readAllDocuments(db));
    await clearEmulator();
    expect(await readAllDocuments(db)).toEqual([]);

    await writeDocuments(db, parseNdjson(backup));

    expect(toNdjson(await readAllDocuments(db))).toBe(backup);
    const types = (await db.doc("misc/types").get()).data()!;
    expect(types.where).toBeInstanceOf(GeoPoint);
    expect(types.link.path).toBe("sessions/7_2");
    expect(types.notANumber).toBeNaN();
    expect(
      (await db.doc("participants/7").get()).get("createdAt").toMillis(),
    ).toBe(1_790_000_000_123);
  });
});
