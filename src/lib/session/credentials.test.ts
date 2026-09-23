// @vitest-environment node
import { describe, expect, test } from "vitest";

import {
  afterWrongPin,
  CredentialError,
  generatePin,
  lockoutState,
  LOCKOUT_MINUTES,
  normaliseParticipantCode,
  normalisePin,
  parseLesson,
  pinMatches,
} from "./credentials";

function problem(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof CredentialError
      ? error.problem
      : "not a CredentialError";
  }
  return undefined;
}

describe("normaliseParticipantCode", () => {
  test.each(["7", "07", "007", " 7 "])(
    "reads %j as the same student",
    (input) => {
      expect(normaliseParticipantCode(input)).toBe("7");
    },
  );

  test("keeps codes above nine", () => {
    expect(normaliseParticipantCode("64")).toBe("64");
  });

  test.each([
    ["", "CODE_MISSING"],
    ["   ", "CODE_MISSING"],
    ["abc", "CODE_FORMAT"],
    ["12a", "CODE_FORMAT"],
    ["1234", "CODE_FORMAT"],
    ["0", "CODE_FORMAT"],
    ["-1", "CODE_FORMAT"],
  ])("rejects %j", (input, expected) => {
    expect(problem(() => normaliseParticipantCode(input))).toBe(expected);
  });
});

describe("normalisePin", () => {
  test("keeps leading zeros", () => {
    expect(normalisePin("0423")).toBe("0423");
  });

  test.each([
    ["", "PIN_MISSING"],
    ["42", "PIN_FORMAT"],
    ["12345", "PIN_FORMAT"],
    ["abcd", "PIN_FORMAT"],
  ])("rejects %j", (input, expected) => {
    expect(problem(() => normalisePin(input))).toBe(expected);
  });
});

describe("parseLesson", () => {
  test.each([1, 2, 3, 4])("accepts lesson %i", (lesson) => {
    expect(parseLesson(String(lesson))).toBe(lesson);
  });

  test.each([null, "", "0", "5", "two"])("rejects %j", (input) => {
    expect(problem(() => parseLesson(input))).toBe("LESSON_MISSING");
  });
});

describe("generatePin", () => {
  test("always produces four digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePin()).toMatch(/^\d{4}$/);
    }
  });
});

describe("pinMatches", () => {
  test("accepts the right PIN and nothing else", () => {
    expect(pinMatches("0423", "0423")).toBe(true);
    expect(pinMatches("0424", "0423")).toBe(false);
    expect(pinMatches("042", "0423")).toBe(false);
    expect(pinMatches("", "0423")).toBe(false);
  });
});

describe("lockoutState", () => {
  const now = new Date("2026-09-23T10:00:00Z");

  test("counts down the attempts left", () => {
    expect(lockoutState(0, null, now)).toEqual({
      locked: false,
      attemptsLeft: 3,
    });
    expect(lockoutState(2, null, now)).toEqual({
      locked: false,
      attemptsLeft: 1,
    });
  });

  test("reports the wait while the lock lasts", () => {
    const lockedUntil = new Date("2026-09-23T10:25:30Z");
    expect(lockoutState(3, lockedUntil, now)).toEqual({
      locked: true,
      minutesLeft: 26,
    });
  });

  test("lets the student try again once the lock has passed", () => {
    const lockedUntil = new Date("2026-09-23T09:30:00Z");
    expect(lockoutState(3, lockedUntil, now)).toEqual({
      locked: false,
      attemptsLeft: 0,
    });
  });
});

describe("afterWrongPin", () => {
  const now = new Date("2026-09-23T10:00:00Z");

  test("locks the code on the third wrong PIN in a row", () => {
    expect(afterWrongPin(0, null, now)).toEqual({
      failedAttempts: 1,
      lockedUntil: null,
    });
    expect(afterWrongPin(1, null, now)).toEqual({
      failedAttempts: 2,
      lockedUntil: null,
    });
    expect(afterWrongPin(2, null, now)).toEqual({
      failedAttempts: 3,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000),
    });
  });

  test("starts counting again after an expired lock", () => {
    const expired = new Date("2026-09-23T09:00:00Z");
    expect(afterWrongPin(3, expired, now)).toEqual({
      failedAttempts: 1,
      lockedUntil: null,
    });
  });
});
