import { randomUUID } from "node:crypto";

import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Transaction,
} from "firebase-admin/firestore";

import type { AnalysisStore } from "@/lib/analysis/run";
import type {
  StoredCoding,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import { getDb } from "@/lib/firebase/admin";
import type { Transcript } from "@/lib/scraping/transcript";

import {
  afterWrongPin,
  lockoutState,
  LESSONS,
  MAX_PIN_ATTEMPTS,
  pinMatches,
  type Lesson,
} from "./credentials";
import { hashSessionToken } from "./session-token";
import {
  analysisInterrupted,
  sessionId,
  type Session,
  type SessionStatus,
} from "./types";

const PARTICIPANTS = "participants";
const SESSIONS = "sessions";
// Firestore documents are limited to 1 MiB. Leave room for the session fields,
// indexes, and later analysis data instead of relying on Firestore's rejection.
export const MAX_STORED_TRANSCRIPT_BYTES = 850_000;

export class TranscriptTooLargeError extends Error {
  constructor() {
    super("The transcript is too large for a session document");
    this.name = "TranscriptTooLargeError";
  }
}

export type StartSessionResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "UNKNOWN_CODE" }
  | { ok: false; reason: "WRONG_PIN"; attemptsLeft: number }
  | { ok: false; reason: "LOCKED"; minutesLeft: number }
  | { ok: false; reason: "ALREADY_COMPLETED" };

export type TranscriptMutationResult =
  | { ok: true; session: Session }
  | {
      ok: false;
      reason: "UNAUTHENTICATED" | "ALREADY_COMPLETED" | "NOT_READY" | "STALE";
    };

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
      transcript: null,
      transcriptConfirmedAt: null,
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
        transcript: null,
        transcriptConfirmedAt: null,
        analysisStartedAt: null,
        analysis: null,
        reflectionQuestions: null,
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

export async function beginTranscriptSubmission(
  token: string,
  attemptId: string,
  submittedLink: string,
  now: Date = new Date(),
): Promise<TranscriptMutationResult> {
  const session = await getSessionByToken(token);
  if (!session) return { ok: false, reason: "UNAUTHENTICATED" };

  const db = getDb();
  const ref = db.collection(SESSIONS).doc(session.id);
  return db.runTransaction<TranscriptMutationResult>(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (
      !snapshot.exists ||
      data?.sessionTokenHash !== hashSessionToken(token)
    ) {
      return { ok: false, reason: "UNAUTHENTICATED" };
    }
    if (data.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }

    tx.update(ref, {
      status: "processing" satisfies SessionStatus,
      activeTranscriptAttemptId: attemptId,
      lastSubmittedLink: submittedLink,
      errorCode: null,
      updatedAt: Timestamp.fromDate(now),
    });
    return {
      ok: true,
      session: {
        ...toSession(snapshot.id, data),
        status: "processing",
        errorCode: null,
        updatedAt: now,
      },
    };
  });
}

export async function saveTranscriptSubmission(
  sessionIdValue: string,
  token: string,
  attemptId: string,
  transcript: Transcript,
  now: Date = new Date(),
): Promise<TranscriptMutationResult> {
  if (transcriptSizeBytes(transcript) > MAX_STORED_TRANSCRIPT_BYTES) {
    throw new TranscriptTooLargeError();
  }

  const db = getDb();
  const ref = db.collection(SESSIONS).doc(sessionIdValue);
  return db.runTransaction<TranscriptMutationResult>(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (
      !snapshot.exists ||
      data?.sessionTokenHash !== hashSessionToken(token)
    ) {
      return { ok: false, reason: "UNAUTHENTICATED" };
    }
    if (data.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }
    if (data.activeTranscriptAttemptId !== attemptId) {
      return { ok: false, reason: "STALE" };
    }

    tx.update(ref, {
      transcript,
      transcriptConfirmedAt: null,
      status: "awaiting_confirmation" satisfies SessionStatus,
      activeTranscriptAttemptId: FieldValue.delete(),
      errorCode: null,
      activeAnalysisAttemptId: FieldValue.delete(),
      analysisStartedAt: FieldValue.delete(),
      analysis: FieldValue.delete(),
      reflectionQuestions: FieldValue.delete(),
      reflectionResponses: FieldValue.delete(),
      analysisFailures: FieldValue.delete(),
      updatedAt: Timestamp.fromDate(now),
    });
    return {
      ok: true,
      session: {
        ...toSession(snapshot.id, data),
        transcript,
        transcriptConfirmedAt: null,
        status: "awaiting_confirmation",
        errorCode: null,
        analysisStartedAt: null,
        analysis: null,
        reflectionQuestions: null,
        updatedAt: now,
      },
    };
  });
}

export async function failTranscriptSubmission(
  sessionIdValue: string,
  token: string,
  attemptId: string,
  errorCode: string,
  now: Date = new Date(),
): Promise<TranscriptMutationResult> {
  const db = getDb();
  const ref = db.collection(SESSIONS).doc(sessionIdValue);
  return db.runTransaction<TranscriptMutationResult>(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (
      !snapshot.exists ||
      data?.sessionTokenHash !== hashSessionToken(token)
    ) {
      return { ok: false, reason: "UNAUTHENTICATED" };
    }
    if (data.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }
    if (data.activeTranscriptAttemptId !== attemptId) {
      return { ok: false, reason: "STALE" };
    }

    tx.update(ref, {
      status: "failed" satisfies SessionStatus,
      activeTranscriptAttemptId: FieldValue.delete(),
      errorCode,
      updatedAt: Timestamp.fromDate(now),
    });
    return {
      ok: true,
      session: {
        ...toSession(snapshot.id, data),
        status: "failed",
        errorCode,
        updatedAt: now,
      },
    };
  });
}

export async function rejectTranscript(
  token: string,
  now: Date = new Date(),
): Promise<TranscriptMutationResult> {
  return updateAuthenticatedSession(token, (current, tx, ref) => {
    if (current.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }
    if (current.status !== "awaiting_confirmation" || !current.transcript) {
      return { ok: false, reason: "NOT_READY" };
    }

    tx.update(ref, {
      status: "awaiting_transcript" satisfies SessionStatus,
      errorCode: null,
      updatedAt: Timestamp.fromDate(now),
    });
    return {
      ok: true,
      session: {
        ...current,
        status: "awaiting_transcript",
        errorCode: null,
        updatedAt: now,
      },
    };
  });
}

// For lessons 2 and 3 the analysis attempt starts in the same transaction, so a
// confirmed session is never left without one.
export async function confirmTranscript(
  token: string,
  analysisAttemptId: string = randomUUID(),
  now: Date = new Date(),
): Promise<TranscriptMutationResult> {
  return updateAuthenticatedSession(token, (current, tx, ref) => {
    if (current.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }
    if (current.status !== "awaiting_confirmation" || !current.transcript) {
      return { ok: false, reason: "NOT_READY" };
    }

    const completed = current.lesson === 1 || current.lesson === 4;
    const status = completed ? "completed" : "processing";
    tx.update(ref, {
      status: status satisfies SessionStatus,
      transcriptConfirmedAt: Timestamp.fromDate(now),
      completedAt: completed ? Timestamp.fromDate(now) : null,
      errorCode: null,
      updatedAt: Timestamp.fromDate(now),
      ...(completed
        ? {}
        : {
            activeAnalysisAttemptId: analysisAttemptId,
            analysisStartedAt: Timestamp.fromDate(now),
          }),
    });
    return {
      ok: true,
      session: {
        ...current,
        status,
        transcriptConfirmedAt: now,
        completedAt: completed ? now : null,
        errorCode: null,
        analysisStartedAt: completed ? null : now,
        updatedAt: now,
      },
    };
  });
}

// A failed analysis, or one that never reported back, can be started again. The
// stored coding is kept, so a retry after step 1 only redoes step 2.
export async function retryAnalysis(
  token: string,
  attemptId: string,
  now: Date = new Date(),
): Promise<TranscriptMutationResult> {
  return updateAuthenticatedSession(token, (current, tx, ref) => {
    if (current.status === "completed") {
      return { ok: false, reason: "ALREADY_COMPLETED" };
    }
    const analysed = current.lesson === 2 || current.lesson === 3;
    const retryable =
      current.status === "failed" || analysisInterrupted(current, now);
    if (!analysed || !current.transcriptConfirmedAt || !retryable) {
      return { ok: false, reason: "NOT_READY" };
    }

    tx.update(ref, {
      status: "processing" satisfies SessionStatus,
      activeAnalysisAttemptId: attemptId,
      analysisStartedAt: Timestamp.fromDate(now),
      errorCode: null,
      updatedAt: Timestamp.fromDate(now),
    });
    return {
      ok: true,
      session: {
        ...current,
        status: "processing",
        analysisStartedAt: now,
        errorCode: null,
        updatedAt: now,
      },
    };
  });
}

// Used by the analysis running in the background. It has no session token; the
// unguessable attempt ID is what lets it write, and only while it is current.
export const analysisStore: AnalysisStore = {
  async load(sessionIdValue, attemptId) {
    const snapshot = await getDb()
      .collection(SESSIONS)
      .doc(sessionIdValue)
      .get();
    const data = snapshot.data();
    if (!data || !isCurrentAnalysis(data, attemptId)) return null;
    const session = toSession(snapshot.id, data);
    if (!session.transcript || !session.transcriptConfirmedAt) return null;
    return { transcript: session.transcript, coding: session.analysis };
  },

  async saveCoding(sessionIdValue, attemptId, coding) {
    return updateCurrentAnalysis(sessionIdValue, attemptId, (now) => ({
      analysis: coding,
      updatedAt: now,
    }));
  },

  async saveQuestions(sessionIdValue, attemptId, questions) {
    return updateCurrentAnalysis(sessionIdValue, attemptId, (now) => ({
      reflectionQuestions: questions,
      status: "awaiting_reflection" satisfies SessionStatus,
      activeAnalysisAttemptId: FieldValue.delete(),
      errorCode: null,
      updatedAt: now,
    }));
  },

  async fail(sessionIdValue, attemptId, errorCode) {
    return updateCurrentAnalysis(sessionIdValue, attemptId, (now) => ({
      status: "failed" satisfies SessionStatus,
      activeAnalysisAttemptId: FieldValue.delete(),
      errorCode,
      // A retry clears errorCode; the history stays in the research record.
      analysisFailures: FieldValue.arrayUnion({ errorCode, at: now }),
      updatedAt: now,
    }));
  },
};

function isCurrentAnalysis(data: DocumentData, attemptId: string): boolean {
  return (
    data.status === "processing" && data.activeAnalysisAttemptId === attemptId
  );
}

async function updateCurrentAnalysis(
  sessionIdValue: string,
  attemptId: string,
  changes: (now: Timestamp) => Record<string, unknown>,
): Promise<boolean> {
  const db = getDb();
  const ref = db.collection(SESSIONS).doc(sessionIdValue);
  return db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data || !isCurrentAnalysis(data, attemptId)) return false;
    tx.update(ref, changes(Timestamp.now()));
    return true;
  });
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
    transcript: toTranscript(data.transcript),
    transcriptConfirmedAt: toDate(data.transcriptConfirmedAt),
    analysisStartedAt: toDate(data.analysisStartedAt),
    analysis: hasArrays(data.analysis, "prompts", "sequences")
      ? (data.analysis as StoredCoding)
      : null,
    reflectionQuestions: hasArrays(data.reflectionQuestions, "items")
      ? (data.reflectionQuestions as StoredReflectionQuestions)
      : null,
  };
}

function hasArrays(value: unknown, ...keys: string[]): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    keys.every((key) => Array.isArray((value as Record<string, unknown>)[key]))
  );
}

function transcriptSizeBytes(transcript: Transcript): number {
  return Buffer.byteLength(JSON.stringify(transcript), "utf8");
}

function toTranscript(value: unknown): Transcript | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Transcript>;
  if (
    !candidate.source ||
    typeof candidate.source !== "object" ||
    !Array.isArray(candidate.messages) ||
    !Array.isArray(candidate.warnings) ||
    typeof candidate.retrievedAt !== "string" ||
    typeof candidate.parserVersion !== "number"
  ) {
    return null;
  }
  return value as Transcript;
}

async function updateAuthenticatedSession(
  token: string,
  update: (
    current: Session,
    tx: Transaction,
    ref: DocumentReference,
  ) => TranscriptMutationResult,
): Promise<TranscriptMutationResult> {
  const session = await getSessionByToken(token);
  if (!session) return { ok: false, reason: "UNAUTHENTICATED" };

  const db = getDb();
  const ref = db.collection(SESSIONS).doc(session.id);
  return db.runTransaction<TranscriptMutationResult>(async (tx) => {
    const snapshot = await tx.get(ref);
    const data = snapshot.data();
    if (
      !snapshot.exists ||
      data?.sessionTokenHash !== hashSessionToken(token)
    ) {
      return { ok: false, reason: "UNAUTHENTICATED" };
    }
    return update(toSession(snapshot.id, data), tx, ref);
  });
}
