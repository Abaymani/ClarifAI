import { randomInt, timingSafeEqual } from "node:crypto";

export const LESSONS = [1, 2, 3, 4] as const;
export type Lesson = (typeof LESSONS)[number];

// Three wrong PINs block the code for half an hour (DL-029).
export const MAX_PIN_ATTEMPTS = 3;
export const LOCKOUT_MINUTES = 30;

export type CredentialProblem =
  | "CODE_MISSING"
  | "CODE_FORMAT"
  | "PIN_MISSING"
  | "PIN_FORMAT"
  | "LESSON_MISSING";

export class CredentialError extends Error {
  readonly problem: CredentialProblem;

  constructor(problem: CredentialProblem) {
    super(problem);
    this.name = "CredentialError";
    this.problem = problem;
  }
}

// Codes are handed out as plain numbers, so 7, 07 and 007 are the same student
// and must reach the same record (DL-029).
export function normaliseParticipantCode(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") throw new CredentialError("CODE_MISSING");
  if (!/^\d{1,3}$/.test(trimmed)) throw new CredentialError("CODE_FORMAT");

  const asNumber = Number(trimmed);
  if (asNumber < 1) throw new CredentialError("CODE_FORMAT");
  return String(asNumber);
}

export function normalisePin(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "") throw new CredentialError("PIN_MISSING");
  if (!/^\d{4}$/.test(trimmed)) throw new CredentialError("PIN_FORMAT");
  return trimmed;
}

export function parseLesson(input: string | null): Lesson {
  const lesson = Number(input);
  if (!LESSONS.includes(lesson as Lesson)) {
    throw new CredentialError("LESSON_MISSING");
  }
  return lesson as Lesson;
}

export function generatePin(): string {
  return String(randomInt(0, 10_000)).padStart(4, "0");
}

// Constant-time comparison keeps the response time from revealing how much of a
// guessed PIN was right.
export function pinMatches(entered: string, stored: string): boolean {
  const a = Buffer.from(entered, "utf8");
  const b = Buffer.from(stored, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type LockoutState =
  | { locked: true; minutesLeft: number }
  | { locked: false; attemptsLeft: number };

export function lockoutState(
  failedAttempts: number,
  lockedUntil: Date | null,
  now: Date,
): LockoutState {
  if (lockedUntil && lockedUntil > now) {
    const minutesLeft = Math.ceil(
      (lockedUntil.getTime() - now.getTime()) / 60_000,
    );
    return { locked: true, minutesLeft };
  }
  return {
    locked: false,
    attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - failedAttempts),
  };
}

// A lock that has expired also clears the attempts, so a returning student starts fresh.
export function afterWrongPin(
  failedAttempts: number,
  lockedUntil: Date | null,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const lockHasExpired = lockedUntil !== null && lockedUntil <= now;
  const attempts = (lockHasExpired ? 0 : failedAttempts) + 1;
  if (attempts >= MAX_PIN_ATTEMPTS) {
    return {
      failedAttempts: attempts,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60_000),
    };
  }
  return { failedAttempts: attempts, lockedUntil: null };
}
