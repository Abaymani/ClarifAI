import type {
  StoredCoding,
  StoredReflectionQuestions,
} from "../analysis/types";
import type { Transcript } from "../scraping/transcript";

import type { Lesson } from "./credentials";

export type TranscriptSubmission = "transcript" | "no_gemini" | null;
export type AnalysisAgreement = "yes" | "partly" | "no";
export const MAX_REFLECTION_ANSWER_LENGTH = 5_000;

export type ReflectionResponse = {
  itemId: string;
  answer: string;
  // Only concrete transcript observations have an analysis to agree with.
  agreement: AnalysisAgreement | null;
};

export type StoredReflectionResponses = {
  submittedAt: Date;
  items: ReflectionResponse[];
};

// `awaiting_transcript` is the state a session starts in, before S1 has a link.
// The rest follow the requirements' list of session states.
export type SessionStatus =
  | "awaiting_transcript"
  | "processing"
  | "awaiting_confirmation"
  | "awaiting_reflection"
  | "completed"
  | "failed";

export type Session = {
  // `${participantCode}_${lesson}`, so a participant can never have two sessions
  // for the same lesson.
  id: string;
  participantCode: string;
  lesson: Lesson;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  errorCode: string | null;
  // Distinguishes a submitted transcript from an explicit declaration that
  // Gemini was not used. Null is retained for sessions created by older code.
  transcriptSubmission: TranscriptSubmission;
  transcript: Transcript | null;
  transcriptConfirmedAt: Date | null;
  analysisStartedAt: Date | null;
  // S2 step 1: the coding, kept as research data.
  analysis: StoredCoding | null;
  // S2 step 2: what the student reflects on in S3.
  reflectionQuestions: StoredReflectionQuestions | null;
  reflectionResponses: StoredReflectionResponses | null;
};

export function sessionId(participantCode: string, lesson: Lesson): string {
  return `${participantCode}_${lesson}`;
}

// Vercel stops the function running an analysis after five minutes. One that has
// been "processing" for longer never reported back, and may be restarted.
export const ANALYSIS_STALE_AFTER_MS = 6 * 60_000;

// A result this version cannot read must not strand the student on an empty page.
export function analysisResultMissing(session: Session): boolean {
  return (
    session.status === "awaiting_reflection" && !session.reflectionQuestions
  );
}

export function analysisInterrupted(session: Session, now: Date): boolean {
  if (session.status !== "processing" || !session.transcriptConfirmedAt) {
    return false;
  }
  return (
    !session.analysisStartedAt ||
    now.getTime() - session.analysisStartedAt.getTime() >
      ANALYSIS_STALE_AFTER_MS
  );
}
