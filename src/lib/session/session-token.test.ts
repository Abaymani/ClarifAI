// @vitest-environment node
import { describe, expect, test } from "vitest";

import { createSessionToken, hashSessionToken } from "./session-token";
import { sessionId } from "./types";

describe("session tokens", () => {
  test("are unguessable and url-safe", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => createSessionToken()),
    );
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  test("are stored only as a hash", () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hash);
    expect(hashSessionToken(createSessionToken())).not.toBe(hash);
  });
});

describe("sessionId", () => {
  test("is one id per participant and lesson", () => {
    expect(sessionId("7", 2)).toBe("7_2");
    expect(sessionId("7", 3)).not.toBe(sessionId("7", 2));
  });
});
