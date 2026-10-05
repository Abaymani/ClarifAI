import type { ResearcherId } from "@/lib/admin/auth";
import type { Lesson } from "@/lib/session/credentials";
import type { SessionStatus, TranscriptSubmission } from "@/lib/session/types";

export type AdminSessionState = "started" | "completed" | "missing";

export type AdminSessionSummary = {
  participantCode: string;
  lesson: Lesson;
  state: Exclude<AdminSessionState, "missing">;
  status: SessionStatus;
  transcriptSubmission: TranscriptSubmission;
  codedBy: ResearcherId[];
};

export type AdminParticipantOverview = {
  participantCode: string;
  sessions: Partial<Record<Lesson, AdminSessionSummary>>;
};

export type ResearcherPromptCoding = {
  id: string;
  kind: "prompt";
  researcherId: ResearcherId;
  message: number;
  note: string;
  codes: string[];
  frameworkVersion: string;
  updatedAt: string;
};

export type ResearcherSequenceCoding = {
  id: string;
  kind: "sequence";
  researcherId: ResearcherId;
  firstMessage: number;
  lastMessage: number;
  note: string;
  codes: string[];
  frameworkVersion: string;
  updatedAt: string;
};

export type ResearcherCoding =
  ResearcherPromptCoding | ResearcherSequenceCoding;

export type AdminCodeOption = {
  code: string;
  name: string;
  description: string;
  examples: string[];
  kind: "prompt" | "sequence";
};
