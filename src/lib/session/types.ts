import type { Lesson } from "./credentials";
import type { Transcript } from "../scraping/transcript";

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
};

export function sessionId(participantCode: string, lesson: Lesson): string {
  return `${participantCode}_${lesson}`;
}
