import type {
  StoredCoding,
  StoredReflectionQuestions,
} from "../analysis/types";
import type { Transcript } from "../scraping/transcript";

import type { Lesson } from "./credentials";

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
  transcript: Transcript | null;
  transcriptConfirmedAt: Date | null;
  analysisStartedAt: Date | null;
  // S2 step 1: the coding, kept as research data.
  analysis: StoredCoding | null;
  // S2 step 2: what the student reflects on in S3.
  reflectionQuestions: StoredReflectionQuestions | null;
};

export function sessionId(participantCode: string, lesson: Lesson): string {
  return `${participantCode}_${lesson}`;
}

// Vercel stops the function running an analysis after five minutes. One that has
// been "processing" for longer never reported back, and may be restarted.
export const ANALYSIS_STALE_AFTER_MS = 6 * 60_000;

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
