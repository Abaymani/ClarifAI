// Backs up a whole Firestore database by reading every document, because the
// managed export needs a billing account, and restores such a backup into the
// emulator (DL-067). Restoring never writes to a real project.
import { createHash } from "node:crypto";

import {
  DocumentReference,
  FieldValue,
  GeoPoint,
  Timestamp,
  type CollectionReference,
  type Firestore,
} from "firebase-admin/firestore";

export const BACKUP_FORMAT = "clarifai-firestore-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const DOCUMENTS_FILE = "documents.ndjson";
export const MANIFEST_FILE = "manifest.json";

// Marks values JSON cannot hold, such as timestamps, so they come back exactly.
const TAG = "__firestore";
// firebase-admin does not export the vector class itself.
const VectorValue = FieldValue.vector([]).constructor;
// Documents fetched per request.
const READ_BATCH = 100;

export type Encoded =
  null | boolean | number | string | Encoded[] | { [key: string]: Encoded };

export type EncodedMap = { [key: string]: Encoded };

export type BackupDocument = { path: string; data: EncodedMap };

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  projectId: string;
  startedAt: string;
  finishedAt: string;
  documentCount: number;
  // Documents per collection, with document IDs in the path replaced by "*".
  collections: Record<string, number>;
  file: typeof DOCUMENTS_FILE;
  bytes: number;
  sha256: string;
};

export function encodeValue(value: unknown): Encoded {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    // Firestore doubles can be NaN or infinite; JSON numbers cannot.
    return Number.isFinite(value)
      ? value
      : { [TAG]: "double", value: String(value) };
  }
  if (value instanceof Timestamp) {
    return {
      [TAG]: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      // For people reading the file; restoring uses seconds and nanoseconds.
      iso: value.toDate().toISOString(),
    };
  }
  if (value instanceof GeoPoint) {
    return {
      [TAG]: "geopoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (value instanceof DocumentReference) {
    return { [TAG]: "reference", path: value.path };
  }
  if (value instanceof VectorValue) {
    return {
      [TAG]: "vector",
      values: (value as { toArray(): number[] }).toArray(),
    };
  }
  if (value instanceof Uint8Array) {
    return { [TAG]: "bytes", base64: Buffer.from(value).toString("base64") };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === "object") {
    const map = encodeMap(value as Record<string, unknown>);
    // A stored map that happens to use the tag key is wrapped, so it is never
    // mistaken for one of the values above.
    return TAG in map ? { [TAG]: "map", value: map } : map;
  }
  throw new Error(`Unsupported Firestore value of type ${typeof value}`);
}

// Sorted keys make the file byte-for-byte reproducible, so a restored database
// can be compared with its backup by checksum.
export function encodeMap(map: Record<string, unknown>): EncodedMap {
  return Object.fromEntries(
    Object.keys(map)
      .sort()
      .map((key) => [key, encodeValue(map[key])]),
  );
}

export function decodeValue(value: Encoded, db: Firestore): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => decodeValue(item, db));

  const tag = value[TAG];
  if (typeof tag !== "string") return decodeMap(value, db);
  switch (tag) {
    case "timestamp":
      return new Timestamp(Number(value.seconds), Number(value.nanoseconds));
    case "geopoint":
      return new GeoPoint(Number(value.latitude), Number(value.longitude));
    case "reference":
      return db.doc(String(value.path));
    case "vector":
      return FieldValue.vector((value.values as number[]).map(Number));
    case "bytes":
      return Buffer.from(String(value.base64), "base64");
    case "double":
      return Number(value.value);
    case "map":
      return decodeMap(value.value as EncodedMap, db);
    default:
      throw new Error(`Unknown value type in backup: ${tag}`);
  }
}

export function decodeMap(
  map: EncodedMap,
  db: Firestore,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [key, decodeValue(value, db)]),
  );
}

// Every document in the database, sorted by path. Only reads.
export async function readAllDocuments(
  db: Firestore,
): Promise<BackupDocument[]> {
  const documents: BackupDocument[] = [];
  for (const collection of await db.listCollections()) {
    await readCollection(db, collection, documents);
  }
  return documents.sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

async function readCollection(
  db: Firestore,
  collection: CollectionReference,
  into: BackupDocument[],
): Promise<void> {
  // listDocuments also returns parents that have no document of their own, only
  // subcollections, such as sessions/<id>/researcherCoding/R1. Reading just the
  // collection's documents would skip everything below them.
  const refs = await collection.listDocuments();
  for (let i = 0; i < refs.length; i += READ_BATCH) {
    const snapshots = await db.getAll(...refs.slice(i, i + READ_BATCH));
    for (const snapshot of snapshots) {
      const data = snapshot.data();
      if (snapshot.exists && data) {
        into.push({ path: snapshot.ref.path, data: encodeMap(data) });
      }
    }
  }
  for (const ref of refs) {
    for (const subcollection of await ref.listCollections()) {
      await readCollection(db, subcollection, into);
    }
  }
}

// Restoring is only for the emulator, so a backup can never overwrite research
// data in a real project.
export async function writeDocuments(
  db: Firestore,
  documents: BackupDocument[],
): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "A backup can only be restored into the Firestore emulator.",
    );
  }
  const writer = db.bulkWriter();
  const writes = documents.map((document) =>
    writer.set(db.doc(document.path), decodeMap(document.data, db)),
  );
  // Settled at once, so a failed write is reported here rather than left unhandled.
  const outcomes = Promise.allSettled(writes);
  await writer.close();
  const failed = (await outcomes).filter(
    (outcome) => outcome.status === "rejected",
  );
  if (failed.length > 0) {
    throw new Error(
      `${failed.length} of ${documents.length} documents could not be written.`,
    );
  }
}

export function toNdjson(documents: BackupDocument[]): string {
  return documents.map((document) => `${JSON.stringify(document)}\n`).join("");
}

export function parseNdjson(text: string): BackupDocument[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed: unknown = JSON.parse(line);
      const document = parsed as Partial<BackupDocument>;
      if (
        typeof document.path !== "string" ||
        document.path.split("/").length % 2 !== 0 ||
        !document.data ||
        typeof document.data !== "object" ||
        Array.isArray(document.data)
      ) {
        throw new Error(`Line ${i + 1} of the backup is not a document.`);
      }
      return { path: document.path, data: document.data };
    });
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// "sessions/12_3/researcherCoding/R1/entries/abc" counts towards
// "sessions/*/researcherCoding/*/entries".
export function collectionCounts(
  documents: BackupDocument[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { path } of documents) {
    const segments = path.split("/").slice(0, -1);
    const pattern = segments
      .map((segment, i) => (i % 2 === 1 ? "*" : segment))
      .join("/");
    counts[pattern] = (counts[pattern] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}
