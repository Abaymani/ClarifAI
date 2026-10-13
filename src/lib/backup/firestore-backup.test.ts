// @vitest-environment node
import {
  FieldValue,
  GeoPoint,
  Timestamp,
  type Firestore,
} from "firebase-admin/firestore";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectionCounts,
  decodeMap,
  decodeValue,
  encodeMap,
  encodeValue,
  parseNdjson,
  toNdjson,
  writeDocuments,
  type BackupDocument,
} from "./firestore-backup";

// References are only built, never read, so a stand-in database is enough.
const db = { doc: (path: string) => ({ path }) } as unknown as Firestore;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("encodeValue and decodeValue", () => {
  it("keep JSON values as they are", () => {
    for (const value of [null, true, false, "text", 0, -3, 2.5]) {
      expect(encodeValue(value)).toBe(value);
      expect(decodeValue(encodeValue(value), db)).toBe(value);
    }
  });

  it("store timestamps to the nanosecond", () => {
    const at = new Timestamp(1_790_000_000, 123_456_789);
    const encoded = encodeValue(at);
    expect(encoded).toEqual({
      __firestore: "timestamp",
      seconds: 1_790_000_000,
      nanoseconds: 123_456_789,
      iso: "2026-09-21T14:13:20.123Z",
    });
    expect(decodeValue(encoded, db)).toEqual(at);
  });

  it("store the other values JSON cannot hold", () => {
    const values = {
      where: new GeoPoint(59.33, 18.07),
      raw: Buffer.from([0, 1, 254, 255]),
      embedding: FieldValue.vector([0.5, 1, -2]),
      notANumber: NaN,
      infinite: Infinity,
    };
    const decoded = decodeMap(encodeMap(values), db);

    expect(decoded.where).toEqual(values.where);
    expect(Buffer.from(decoded.raw as Uint8Array)).toEqual(values.raw);
    expect(decoded.embedding).toEqual(values.embedding);
    expect(decoded.notANumber).toBeNaN();
    expect(decoded.infinite).toBe(Infinity);
    expect(
      decodeValue({ __firestore: "reference", path: "sessions/7_2" }, db),
    ).toEqual({
      path: "sessions/7_2",
    });
  });

  it("keep a stored map that uses the marker key as a map", () => {
    const stored = { note: { __firestore: "not a type", n: 1 } };
    const encoded = encodeMap(stored);
    expect(encoded.note).toEqual({
      __firestore: "map",
      value: { __firestore: "not a type", n: 1 },
    });
    expect(decodeMap(encoded, db)).toEqual(stored);
  });

  it("refuse a value type it does not know", () => {
    expect(() => decodeValue({ __firestore: "mystery" }, db)).toThrow(
      /mystery/,
    );
  });
});

describe("encodeMap", () => {
  it("sorts keys at every level, so the same data always gives the same file", () => {
    const a = encodeMap({ b: 1, a: { d: [{ y: 1, x: 2 }], c: 2 } });
    const b = encodeMap({ a: { c: 2, d: [{ x: 2, y: 1 }] }, b: 1 });
    expect(JSON.stringify(a)).toBe('{"a":{"c":2,"d":[{"x":2,"y":1}]},"b":1}');
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("toNdjson and parseNdjson", () => {
  it("write one document per line and read it back", () => {
    const documents: BackupDocument[] = [
      { path: "participants/7", data: { pin: "1234" } },
      {
        path: "sessions/7_2/researcherCoding/R1/entries/a",
        data: { code: "P3" },
      },
    ];
    const text = toNdjson(documents);
    expect(text.split("\n")).toHaveLength(3);
    expect(parseNdjson(text)).toEqual(documents);
  });

  it("refuse lines that are not documents", () => {
    expect(() => parseNdjson('{"path":"sessions","data":{}}\n')).toThrow(
      /Line 1/,
    );
    expect(() => parseNdjson('{"path":"sessions/1","data":[]}\n')).toThrow(
      /Line 1/,
    );
    expect(() => parseNdjson('{"data":{}}\n')).toThrow(/Line 1/);
  });
});

describe("collectionCounts", () => {
  it("counts documents per collection, with document IDs as *", () => {
    expect(
      collectionCounts([
        { path: "participants/1", data: {} },
        { path: "participants/2", data: {} },
        { path: "sessions/1_2", data: {} },
        { path: "sessions/1_2/researcherCoding/R1/entries/a", data: {} },
        { path: "sessions/2_3/researcherCoding/R2/entries/b", data: {} },
      ]),
    ).toEqual({
      participants: 2,
      sessions: 1,
      "sessions/*/researcherCoding/*/entries": 2,
    });
  });
});

describe("writeDocuments", () => {
  it("refuses to write anywhere but the emulator", async () => {
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", undefined);
    const doc = vi.fn();
    await expect(
      writeDocuments({ doc } as unknown as Firestore, [
        { path: "a/b", data: {} },
      ]),
    ).rejects.toThrow(/emulator/);
    expect(doc).not.toHaveBeenCalled();
  });
});
