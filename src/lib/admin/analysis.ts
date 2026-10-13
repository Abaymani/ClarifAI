import "server-only";

import { Timestamp, type DocumentData } from "firebase-admin/firestore";

import type { ResearcherId } from "@/lib/admin/auth";
import type { AdminLessonAnalysisRequest } from "@/lib/admin/types";
import type { AnalysisStore } from "@/lib/analysis/run";
import { getDb } from "@/lib/firebase/admin";
import { sessionFromDocument } from "@/lib/session/store";

const SESSIONS = "sessions";

export type RequestAdminLessonAnalysisResult =
  | { ok: true; request: AdminLessonAnalysisRequest }
  | {
      ok: false;
      reason:
        | "SESSION_NOT_FOUND"
        | "NOT_ELIGIBLE"
        | "NO_TRANSCRIPT"
        | "ALREADY_REQUESTED";
    };

export async function requestAdminLessonAnalysis(input: {
  sessionId: string;
  researcherId: ResearcherId;
  attemptId: string;
  now?: Date;
}): Promise<RequestAdminLessonAnalysisResult> {
  if (!/^\d{1,3}_(1|4)$/.test(input.sessionId)) {
    return { ok: false, reason: "NOT_ELIGIBLE" };
  }

  const now = input.now ?? new Date();
  const ref = getDb().collection(SESSIONS).doc(input.sessionId);
  return getDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return { ok: false, reason: "SESSION_NOT_FOUND" };

    const data = snapshot.data() ?? {};
    const session = sessionFromDocument(snapshot.id, data);
    if (session.lesson !== 1 && session.lesson !== 4) {
      return { ok: false, reason: "NOT_ELIGIBLE" };
    }

    // Any previous request or result owns this one-time slot, including data
    // created by an older version without request metadata.
    if (
      data.adminAnalysisRequest != null ||
      data.analysis != null ||
      data.reflectionQuestions != null
    ) {
      return { ok: false, reason: "ALREADY_REQUESTED" };
    }
    if (
      session.status !== "completed" ||
      session.transcriptSubmission !== "transcript" ||
      !session.transcript ||
      !session.transcriptConfirmedAt
    ) {
      return { ok: false, reason: "NO_TRANSCRIPT" };
    }

    const stored = {
      status: "processing" as const,
      attemptId: input.attemptId,
      requestedBy: input.researcherId,
      requestedAt: Timestamp.fromDate(now),
      finishedAt: null,
      errorCode: null,
    };
    tx.update(ref, { adminAnalysisRequest: stored });
    return {
      ok: true,
      request: requestForClient(stored),
    };
  });
}

export function adminLessonAnalysisRequestFromDocument(
  data: DocumentData,
): AdminLessonAnalysisRequest | null {
  const request = data.adminAnalysisRequest;
  if (!request || typeof request !== "object") return null;
  if (
    request.status !== "processing" &&
    request.status !== "completed" &&
    request.status !== "failed"
  ) {
    return null;
  }
  if (
    (request.requestedBy !== "R1" && request.requestedBy !== "R2") ||
    !(request.requestedAt instanceof Timestamp)
  ) {
    return null;
  }
  return requestForClient(request);
}

// Admin-triggered analysis uses the same result fields as the student flow but
// deliberately has its own guard. It never changes the student's workflow fields.
export const adminLessonAnalysisStore: AnalysisStore = {
  async load(sessionId, attemptId) {
    const snapshot = await getDb().collection(SESSIONS).doc(sessionId).get();
    const data = snapshot.data();
    if (!data || !isCurrentRequest(data, attemptId)) return null;
    const session = sessionFromDocument(snapshot.id, data);
    if (
      (session.lesson !== 1 && session.lesson !== 4) ||
      session.status !== "completed" ||
      !session.transcript ||
      !session.transcriptConfirmedAt
    ) {
      return null;
    }
    return { transcript: session.transcript, coding: null };
  },

  async saveCoding(sessionId, attemptId, coding) {
    return updateCurrentRequest(sessionId, attemptId, (data) =>
      data.analysis == null ? { analysis: coding } : null,
    );
  },

  async saveQuestions(sessionId, attemptId, questions) {
    return updateCurrentRequest(sessionId, attemptId, (data, now) => {
      if (data.reflectionQuestions != null) return null;
      return {
        reflectionQuestions: questions,
        adminAnalysisRequest: finishedRequest(data, "completed", now, null),
      };
    });
  },

  async fail(sessionId, attemptId, errorCode) {
    return updateCurrentRequest(sessionId, attemptId, (data, now) => ({
      adminAnalysisRequest: finishedRequest(data, "failed", now, errorCode),
    }));
  },
};

function isCurrentRequest(data: DocumentData, attemptId: string): boolean {
  const request = data.adminAnalysisRequest;
  return request?.status === "processing" && request.attemptId === attemptId;
}

async function updateCurrentRequest(
  sessionId: string,
  attemptId: string,
  changes: (
    data: DocumentData,
    now: Timestamp,
  ) => Record<string, unknown> | null,
): Promise<boolean> {
  const ref = getDb().collection(SESSIONS).doc(sessionId);
  return getDb().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    if (!data || !isCurrentRequest(data, attemptId)) return false;
    const update = changes(data, Timestamp.now());
    if (!update) return false;
    tx.update(ref, update);
    return true;
  });
}

function finishedRequest(
  data: DocumentData,
  status: "completed" | "failed",
  finishedAt: Timestamp,
  errorCode: string | null,
): Record<string, unknown> {
  return {
    ...data.adminAnalysisRequest,
    status,
    finishedAt,
    errorCode,
  };
}

function requestForClient(request: DocumentData): AdminLessonAnalysisRequest {
  return {
    status: request.status,
    requestedBy: request.requestedBy,
    requestedAt: request.requestedAt.toDate().toISOString(),
    finishedAt:
      request.finishedAt instanceof Timestamp
        ? request.finishedAt.toDate().toISOString()
        : null,
    errorCode: typeof request.errorCode === "string" ? request.errorCode : null,
  };
}
