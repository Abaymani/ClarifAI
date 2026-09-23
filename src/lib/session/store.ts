import { Timestamp } from "firebase-admin/firestore";

import { getDb } from "@/lib/firebase/admin";

import {
  afterWrongPin,
  lockoutState,
  LESSONS,
  MAX_PIN_ATTEMPTS,
  pinMatches,
  type Lesson,
} from "./credentials";
import { hashSessionToken } from "./session-token";
import { sessionId, type Session, type SessionStatus } from "./types";

const PARTICIPANTS = "participants";
const SESSIONS = "sessions";

export type StartSessionResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "UNKNOWN_CODE" }
  | { ok: false; reason: "WRONG_PIN"; attemptsLeft: number }
  | { ok: false; reason: "LOCKED"; minutesLeft: number }
  | { ok: false; reason: "ALREADY_COMPLETED" };

// Everything happens in one transaction so that repeated clicks cannot create a
// second session or skip an attempt count.
export async function startSession(
  input: { code: string; pin: string; lesson: Lesson },
  sessionTokenHash: string,
  now: Date = new Date(),
): Promise<StartSessionResult> {
  const db = getDb();
  const participantRef = db.collection(PARTICIPANTS).doc(input.code);
  const id = sessionId(input.code, input.lesson);
  const sessionRef = db.collection(SESSIONS).doc(id);

  return db.runTransaction<StartSessionResult>(async (tx) => {
    const [participantSnap, sessionSnap] = await Promise.all([
      tx.get(participantRef),
      tx.get(sessionRef),
    ]);

    if (!participantSnap.exists) return { ok: false, reason: "UNKNOWN_CODE" };

    const participant = participantSnap.data() ?? {};
    const failedAttempts = Number(participant.failedAttempts ?? 0);
    const lockedUntil = toDate(participant.lockedUntil);

    const lock = lockoutState(failedAttempts, lockedUntil, now);
    if (lock.locked) {
      return { ok: false, reason: "LOCKED", minutesLeft: lock.minutesLeft };
    }

    const storedPin = participant.pin;
    if (typeof storedPin !== "string" || !pinMatches(input.pin, storedPin)) {
      const next = afterWrongPin(failedAttempts, lockedUntil, now);
      tx.update(participantRef, {
        failedAttempts: next.failedAttempts,
        lockedUntil: next.lockedUntil
          ? Timestamp.fromDate(next.lockedUntil)
          : null,
      });
      if (next.lockedUntil) {
        const minutesLeft = Math.ceil(
          (next.lockedUntil.getTime() - now.getTime()) / 60_000,
        );
        return { ok: false, reason: "LOCKED", minutesLeft };
      }
      return {
        ok: false,
        reason: "WRONG_PIN",
        attemptsLeft: MAX_PIN_ATTEMPTS - next.failedAttempts,
      };
    }

    tx.update(participantRef, { failedAttempts: 0, lockedUntil: null });

    const existing = sessionSnap.exists
      ? toSession(id, sessionSnap.data() ?? {})
      : null;
    if (existing?.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }

    if (existing) {
      tx.update(sessionRef, {
        sessionTokenHash,
        updatedAt: Timestamp.fromDate(now),
      });
      return { ok: true, session: { ...existing, updatedAt: now } };
    }

    tx.set(sessionRef, {
      participantCode: input.code,
      lesson: input.lesson,
      status: "awaiting_transcript" satisfies SessionStatus,
      sessionTokenHash,
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      completedAt: null,
      errorCode: null,
    });
    return {
      ok: true,
      session: {
        id,
        participantCode: input.code,
        lesson: input.lesson,
        status: "awaiting_transcript",
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        errorCode: null,
      },
    };
  });
}

export async function getSessionByToken(
  token: string,
): Promise<Session | null> {
  const snapshot = await getDb()
    .collection(SESSIONS)
    .where("sessionTokenHash", "==", hashSessionToken(token))
    .limit(1)
    .get();

  const doc = snapshot.docs[0];
  return doc ? toSession(doc.id, doc.data()) : null;
}

// Existing codes keep the PIN the student was given, so re-running the generator
// never invalidates a slip that is already handed out.
export async function ensureParticipants(
  entries: { code: string; pin: string }[],
  now: Date = new Date(),
): Promise<{ code: string; pin: string; created: boolean }[]> {
  const db = getDb();
  const results: { code: string; pin: string; created: boolean }[] = [];

  for (const entry of entries) {
    const ref = db.collection(PARTICIPANTS).doc(entry.code);
    const snapshot = await ref.get();
    const existingPin = snapshot.data()?.pin;

    if (snapshot.exists && typeof existingPin === "string") {
      results.push({ code: entry.code, pin: existingPin, created: false });
      continue;
    }

    await ref.set({
      code: entry.code,
      pin: entry.pin,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: Timestamp.fromDate(now),
    });
    results.push({ code: entry.code, pin: entry.pin, created: true });
  }

  return results;
}

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toSession(id: string, data: Record<string, unknown>): Session {
  const lesson = Number(data.lesson);
  return {
    id,
    participantCode: String(data.participantCode ?? ""),
    lesson: (LESSONS.includes(lesson as Lesson) ? lesson : 1) as Lesson,
    status: (data.status as SessionStatus) ?? "awaiting_transcript",
    createdAt: toDate(data.createdAt) ?? new Date(0),
    updatedAt: toDate(data.updatedAt) ?? new Date(0),
    completedAt: toDate(data.completedAt),
    errorCode: typeof data.errorCode === "string" ? data.errorCode : null,
  };
}
