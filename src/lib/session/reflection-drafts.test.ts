import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearStoredDrafts,
  hasWrittenAnswer,
  parseDrafts,
  readStoredDrafts,
  reflectionDraftKey,
  storeDrafts,
} from "./reflection-drafts";
import { MAX_REFLECTION_ANSWER_LENGTH } from "./types";

const items = [{ id: "q1" }, { id: "q2" }];
const empty = { answer: "", agreement: null };

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("reflectionDraftKey", () => {
  it("is different for another session and for another set of questions", () => {
    const key = reflectionDraftKey("12_3", "2026-09-30T10:00:00.000Z");
    expect(key).not.toBe(
      reflectionDraftKey("13_3", "2026-09-30T10:00:00.000Z"),
    );
    expect(key).not.toBe(
      reflectionDraftKey("12_3", "2026-09-30T10:05:00.000Z"),
    );
  });
});

describe("parseDrafts", () => {
  it("starts every item empty when nothing is stored", () => {
    expect(parseDrafts(null, items)).toEqual({ q1: empty, q2: empty });
  });

  it("fills in what was stored for the items on the page", () => {
    const stored = JSON.stringify({
      q1: { answer: "Jag ville prova själv.", agreement: "partly" },
    });
    expect(parseDrafts(stored, items)).toEqual({
      q1: { answer: "Jag ville prova själv.", agreement: "partly" },
      q2: empty,
    });
  });

  it("leaves out stored items that are not on the page", () => {
    const stored = JSON.stringify({ q9: { answer: "Annat", agreement: "no" } });
    expect(parseDrafts(stored, items)).toEqual({ q1: empty, q2: empty });
  });

  it("ignores text that cannot be read", () => {
    for (const stored of ["{not json", '"text"', "null", "[1, 2]"]) {
      expect(parseDrafts(stored, items)).toEqual({ q1: empty, q2: empty });
    }
  });

  it("only keeps values the form itself could have produced", () => {
    const stored = JSON.stringify({
      q1: { answer: 42, agreement: "maybe" },
      q2: { answer: "a".repeat(MAX_REFLECTION_ANSWER_LENGTH + 10) },
    });
    const drafts = parseDrafts(stored, items);
    expect(drafts.q1).toEqual(empty);
    expect(drafts.q2.answer).toHaveLength(MAX_REFLECTION_ANSWER_LENGTH);
    expect(drafts.q2.agreement).toBeNull();
  });
});

describe("hasWrittenAnswer", () => {
  it("counts text, not choices or blank space", () => {
    expect(hasWrittenAnswer({ q1: empty })).toBe(false);
    expect(hasWrittenAnswer({ q1: { answer: "  \n", agreement: "yes" } })).toBe(
      false,
    );
    expect(
      hasWrittenAnswer({ q1: empty, q2: { ...empty, answer: "Ja" } }),
    ).toBe(true);
  });
});

describe("the tab's copy", () => {
  const key = reflectionDraftKey("12_3", "2026-09-30T10:00:00.000Z");
  const drafts = {
    q1: { answer: "Utkast", agreement: "no" as const },
    q2: empty,
  };

  it("comes back as it was stored", () => {
    expect(readStoredDrafts(key)).toBeNull();

    storeDrafts(key, drafts);

    expect(parseDrafts(readStoredDrafts(key), items)).toEqual(drafts);
  });

  it("is removed for every set of questions, and nothing else is", () => {
    const other = reflectionDraftKey("12_3", "2026-09-30T10:05:00.000Z");
    storeDrafts(key, drafts);
    storeDrafts(other, drafts);
    sessionStorage.setItem("something-else", "kept");

    clearStoredDrafts();

    expect(readStoredDrafts(key)).toBeNull();
    expect(readStoredDrafts(other)).toBeNull();
    expect(sessionStorage.getItem("something-else")).toBe("kept");
  });

  it("is given up quietly when the browser refuses", () => {
    storeDrafts(key, drafts);
    const refuse = () => {
      throw new DOMException("refused", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(refuse);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(refuse);
    vi.spyOn(Storage.prototype, "key").mockImplementation(refuse);

    expect(() => storeDrafts(key, drafts)).not.toThrow();
    expect(readStoredDrafts(key)).toBeNull();
    expect(() => clearStoredDrafts()).not.toThrow();
  });
});
