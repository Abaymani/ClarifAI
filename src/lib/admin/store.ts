import "server-only";

import { cache } from "react";
import { Timestamp } from "firebase-admin/firestore";

import type { ResearcherId } from "@/lib/admin/auth";
import { adminLessonAnalysisRequestFromDocument } from "@/lib/admin/analysis";
import {
  LESSON_ONE_CODES_COLLECTION,
  LESSON_ONE_CODES_DOC,
  codesToCheckForOwnLessonOne,
  parseLessonOneCodes,
  storedParticipantCode,
  studyParticipantCode,
  type LessonOneCodesState,
} from "@/lib/admin/lesson-one-codes";
import { MAX_REFLECTION_COMMENT_LENGTH } from "@/lib/admin/types";
import type {
  AdminParticipantOverview,
  AdminReflectionAssessment,
  AdminSession,
  ReflectionCommentsByResearcher,
  ResearcherCoding,
  ResearcherPromptCoding,
  ResearcherReflectionComment,
  ResearcherSequenceCoding,
} from "@/lib/admin/types";
import { loadFramework } from "@/lib/analysis/framework";
import { getDb } from "@/lib/firebase/admin";
import type { Lesson } from "@/lib/session/credentials";
import { sessionFromDocument } from "@/lib/session/store";
import type { Session } from "@/lib/session/types";

const PARTICIPANTS = "participants";
const SESSIONS = "sessions";
const RESEARCHER_CODING = "researcherCoding";
const RESEARCHER_REFLECTION_COMMENTS = "researcherReflectionComments";
const ENTRIES = "entries";
export const MAX_RESEARCHER_NOTE_LENGTH = 5_000;

// Read once per request. A mapping that cannot be applied safely is ignored as a
// whole, so no lesson 1 is ever shown under two participants (DL-072).
export const loadLessonOneCodes = cache(
  async (): Promise<LessonOneCodesState> => {
    const db = getDb();
    const snapshot = await db
      .collection(LESSON_ONE_CODES_COLLECTION)
      .doc(LESSON_ONE_CODES_DOC)
      .get();
    if (!snapshot.exists) return { status: "none" };

    const parsed = parseLessonOneCodes(snapshot.data()?.codes);
    if (!parsed.ok) return { status: "ignored", problem: parsed.problem };

    const toCheck = codesToCheckForOwnLessonOne(parsed.codes);
    const own =
      toCheck.length > 0
        ? await db.getAll(
            ...toCheck.map((code) => db.collection(SESSIONS).doc(`${code}_1`)),
          )
        : [];
    const conflict = own.find((session) => session.exists);
    if (conflict) {
      return {
        status: "ignored",
        problem: { kind: "conflict", code: conflict.id.split("_")[0] },
      };
    }
    return { status: "applied", codes: parsed.codes };
  },
);

export async function listAdminOverview(): Promise<AdminParticipantOverview[]> {
  const db = getDb();
  const [participants, sessions, codingEntries, lessonOneCodes] =
    await Promise.all([
      db.collection(PARTICIPANTS).get(),
      db.collection(SESSIONS).get(),
      db.collectionGroup(ENTRIES).select("researcherId").get(),
      loadLessonOneCodes(),
    ]);
  const codes =
    lessonOneCodes.status === "applied" ? lessonOneCodes.codes : null;

  const codingBySession = new Map<string, Set<ResearcherId>>();
  for (const doc of codingEntries.docs) {
    const match =
      /^sessions\/([^/]+)\/researcherCoding\/(R1|R2)\/entries\/[^/]+$/.exec(
        doc.ref.path,
      );
    if (!match) continue;
    const sessionId = match[1];
    const researcherId = match[2] as ResearcherId;
    const researchers = codingBySession.get(sessionId) ?? new Set();
    researchers.add(researcherId);
    codingBySession.set(sessionId, researchers);
  }

  const byParticipant = new Map<string, AdminParticipantOverview>();
  for (const doc of participants.docs) {
    const code = String(doc.data().code ?? doc.id);
    byParticipant.set(code, { participantCode: code, sessions: {} });
  }
  for (const doc of sessions.docs) {
    const session = sessionFromDocument(doc.id, doc.data());
    const participantCode = studyParticipantCode(
      codes,
      session.participantCode,
      session.lesson,
    );
    const participant = byParticipant.get(participantCode) ?? {
      participantCode,
      sessions: {},
    };
    participant.sessions[session.lesson] = {
      participantCode,
      ...(participantCode !== session.participantCode
        ? { submittedCode: session.participantCode }
        : {}),
      lesson: session.lesson,
      state: session.status === "completed" ? "completed" : "started",
      status: session.status,
      transcriptSubmission: session.transcriptSubmission,
      codedBy: (["R1", "R2"] as const).filter((researcherId) =>
        codingBySession.get(session.id)?.has(researcherId),
      ),
      reflectionAssessment: reflectionAssessment(session),
    };
    byParticipant.set(participantCode, participant);
  }

  return [...byParticipant.values()].sort((a, b) =>
    a.participantCode.localeCompare(b.participantCode, "sv", {
      numeric: true,
    }),
  );
}

function reflectionAssessment(session: Session): AdminReflectionAssessment {
  const items =
    session.reflectionQuestions?.items.filter((item) => item.basedOn) ?? [];
  if (items.length === 0) return { state: "unavailable" };
  if (!session.reflectionResponses) return { state: "not_submitted" };

  const responseByItem = new Map(
    session.reflectionResponses.items.map((response) => [
      response.itemId,
      response,
    ]),
  );
  return {
    state: "submitted",
    agreements: items.map(
      (item) => responseByItem.get(item.id)?.agreement ?? null,
    ),
  };
}

export type AdminParticipantLesson = {
  session: AdminSession | null;
  // The code this lesson 1 was handed in under, when it is another code.
  submittedCode: string | null;
  // The participant whose lesson 1 is stored under this code instead.
  shownUnder: string | null;
  lessonOneCodes: LessonOneCodesState;
};

// A participant's session for a lesson, as the portal shows it: a lesson 1 handed
// in under an earlier code is found through the mapping.
export async function getAdminParticipantLesson(
  participantCode: string,
  lesson: Lesson,
): Promise<AdminParticipantLesson> {
  const lessonOneCodes = await loadLessonOneCodes();
  const codes =
    lessonOneCodes.status === "applied" ? lessonOneCodes.codes : null;
  const storedCode = storedParticipantCode(codes, participantCode, lesson);
  const session = storedCode
    ? await getAdminSessionById(`${storedCode}_${lesson}`)
    : null;
  return {
    session,
    submittedCode:
      session && storedCode !== participantCode ? storedCode : null,
    shownUnder: storedCode
      ? null
      : (codes?.toStudyCode.get(participantCode) ?? null),
    lessonOneCodes,
  };
}

// Reading and writing always go by the session's own document, never through the
// lesson 1 mapping, so coding and comments stay with the session they belong to.
export async function getAdminSessionById(
  sessionId: string,
): Promise<AdminSession | null> {
  const snapshot = await getDb().collection(SESSIONS).doc(sessionId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  return {
    ...sessionFromDocument(snapshot.id, data),
    adminAnalysisRequest: adminLessonAnalysisRequestFromDocument(data),
  };
}

export async function listResearcherCoding(
  sessionId: string,
): Promise<Record<ResearcherId, ResearcherCoding[]>> {
  const [r1, r2] = await Promise.all([
    codingEntries(sessionId, "R1").get(),
    codingEntries(sessionId, "R2").get(),
  ]);
  return {
    R1: r1.docs.flatMap((doc) => parseEntry(doc.id, doc.data(), "R1")),
    R2: r2.docs.flatMap((doc) => parseEntry(doc.id, doc.data(), "R2")),
  };
}

export async function listReflectionComments(
  sessionId: string,
): Promise<ReflectionCommentsByResearcher> {
  const [r1, r2] = await Promise.all([
    reflectionCommentEntries(sessionId, "R1").get(),
    reflectionCommentEntries(sessionId, "R2").get(),
  ]);
  return {
    R1: r1.docs.flatMap((doc) =>
      parseReflectionComment(doc.id, doc.data(), "R1"),
    ),
    R2: r2.docs.flatMap((doc) =>
      parseReflectionComment(doc.id, doc.data(), "R2"),
    ),
  };
}

export async function saveReflectionComment(input: {
  sessionId: string;
  researcherId: ResearcherId;
  itemId: string;
  comment: string;
  now?: Date;
}): Promise<ResearcherReflectionComment | null> {
  const session = await requiredSession(input.sessionId);
  const item = session.reflectionQuestions?.items.find(
    (candidate) => candidate.id === input.itemId,
  );
  if (!item) throw new AdminCodingError("INVALID_REFLECTION_ITEM");

  const comment = input.comment.trim();
  if (comment.length > MAX_REFLECTION_COMMENT_LENGTH) {
    throw new AdminCodingError("INVALID_COMMENT");
  }
  const ref = reflectionCommentEntries(session.id, input.researcherId).doc(
    item.id,
  );
  if (!comment) {
    await ref.delete();
    return null;
  }

  const now = input.now ?? new Date();
  await ref.set({
    researcherId: input.researcherId,
    itemId: item.id,
    comment,
    updatedAt: Timestamp.fromDate(now),
  });
  return {
    researcherId: input.researcherId,
    itemId: item.id,
    comment,
    updatedAt: now.toISOString(),
  };
}

export async function savePromptCoding(input: {
  sessionId: string;
  researcherId: ResearcherId;
  message: number;
  note: string;
  codes: string[];
  now?: Date;
}): Promise<ResearcherPromptCoding> {
  const session = await requiredSession(input.sessionId);
  const message = session.transcript?.messages.find(
    (candidate) => candidate.index === input.message,
  );
  if (!message || message.role !== "student") {
    throw new AdminCodingError("INVALID_PROMPT");
  }
  const note = validNote(input.note);
  const { codes, frameworkVersion } = validCodes(input.codes, "prompt");
  const now = input.now ?? new Date();
  const id = `prompt-${message.index}`;
  const ref = codingEntries(session.id, input.researcherId).doc(id);

  if (!note && codes.length === 0) {
    await ref.delete();
  } else {
    await ref.set({
      kind: "prompt",
      researcherId: input.researcherId,
      message: message.index,
      note,
      codes,
      frameworkVersion,
      updatedAt: Timestamp.fromDate(now),
    });
  }
  return {
    id,
    kind: "prompt",
    researcherId: input.researcherId,
    message: message.index,
    note,
    codes,
    frameworkVersion,
    updatedAt: now.toISOString(),
  };
}

export async function saveSequenceCoding(input: {
  sessionId: string;
  researcherId: ResearcherId;
  id: string;
  firstMessage: number;
  lastMessage: number;
  note: string;
  codes: string[];
  now?: Date;
}): Promise<ResearcherSequenceCoding> {
  if (!/^sequence-[a-zA-Z0-9-]{8,80}$/.test(input.id)) {
    throw new AdminCodingError("INVALID_SEQUENCE");
  }
  const session = await requiredSession(input.sessionId);
  const indexes = new Set(
    session.transcript?.messages.map((message) => message.index) ?? [],
  );
  if (
    !indexes.has(input.firstMessage) ||
    !indexes.has(input.lastMessage) ||
    input.firstMessage > input.lastMessage
  ) {
    throw new AdminCodingError("INVALID_SEQUENCE");
  }
  const note = validNote(input.note);
  const { codes, frameworkVersion } = validCodes(input.codes, "sequence");
  if (!note && codes.length === 0) {
    throw new AdminCodingError("EMPTY_ENTRY");
  }
  const now = input.now ?? new Date();
  await codingEntries(session.id, input.researcherId)
    .doc(input.id)
    .set({
      kind: "sequence",
      researcherId: input.researcherId,
      firstMessage: input.firstMessage,
      lastMessage: input.lastMessage,
      note,
      codes,
      frameworkVersion,
      updatedAt: Timestamp.fromDate(now),
    });
  return {
    id: input.id,
    kind: "sequence",
    researcherId: input.researcherId,
    firstMessage: input.firstMessage,
    lastMessage: input.lastMessage,
    note,
    codes,
    frameworkVersion,
    updatedAt: now.toISOString(),
  };
}

export async function deleteSequenceCoding(input: {
  sessionId: string;
  researcherId: ResearcherId;
  id: string;
}): Promise<void> {
  if (!/^sequence-[a-zA-Z0-9-]{8,80}$/.test(input.id)) {
    throw new AdminCodingError("INVALID_SEQUENCE");
  }
  await requiredSession(input.sessionId);
  await codingEntries(input.sessionId, input.researcherId)
    .doc(input.id)
    .delete();
}

export class AdminCodingError extends Error {
  constructor(
    readonly code:
      | "SESSION_NOT_FOUND"
      | "INVALID_PROMPT"
      | "INVALID_SEQUENCE"
      | "INVALID_NOTE"
      | "INVALID_CODE"
      | "EMPTY_ENTRY"
      | "INVALID_REFLECTION_ITEM"
      | "INVALID_COMMENT",
  ) {
    super(code);
    this.name = "AdminCodingError";
  }
}

function codingEntries(sessionId: string, researcherId: ResearcherId) {
  return getDb()
    .collection(SESSIONS)
    .doc(sessionId)
    .collection(RESEARCHER_CODING)
    .doc(researcherId)
    .collection(ENTRIES);
}

function reflectionCommentEntries(
  sessionId: string,
  researcherId: ResearcherId,
) {
  return getDb()
    .collection(SESSIONS)
    .doc(sessionId)
    .collection(RESEARCHER_REFLECTION_COMMENTS)
    .doc(researcherId)
    .collection(ENTRIES);
}

async function requiredSession(sessionId: string): Promise<Session> {
  if (!/^\d{1,3}_[1-4]$/.test(sessionId)) {
    throw new AdminCodingError("SESSION_NOT_FOUND");
  }
  const session = await getAdminSessionById(sessionId);
  if (!session) throw new AdminCodingError("SESSION_NOT_FOUND");
  return session;
}

function validNote(value: string): string {
  const note = value.trim();
  if (note.length > MAX_RESEARCHER_NOTE_LENGTH) {
    throw new AdminCodingError("INVALID_NOTE");
  }
  return note;
}

function validCodes(
  values: string[],
  kind: "prompt" | "sequence",
): { codes: string[]; frameworkVersion: string } {
  const framework = loadFramework();
  const allowed = new Set(
    (kind === "prompt"
      ? framework.promptCodes
      : framework.sequencePatterns
    ).map((entry) => entry.code),
  );
  const codes = [...new Set(values.map((value) => value.trim()))].filter(
    Boolean,
  );
  if (codes.length > 20 || codes.some((code) => !allowed.has(code))) {
    throw new AdminCodingError("INVALID_CODE");
  }
  return { codes, frameworkVersion: framework.version };
}

function parseEntry(
  id: string,
  data: Record<string, unknown>,
  researcherId: ResearcherId,
): ResearcherCoding[] {
  const note = typeof data.note === "string" ? data.note : "";
  const codes = Array.isArray(data.codes)
    ? data.codes.filter((code): code is string => typeof code === "string")
    : [];
  const updatedAt =
    data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate().toISOString()
      : new Date(0).toISOString();
  const frameworkVersion =
    typeof data.frameworkVersion === "string"
      ? data.frameworkVersion
      : "unknown";

  if (data.kind === "prompt" && Number.isInteger(data.message)) {
    return [
      {
        id,
        kind: "prompt",
        researcherId,
        message: Number(data.message),
        note,
        codes,
        frameworkVersion,
        updatedAt,
      },
    ];
  }
  if (
    data.kind === "sequence" &&
    Number.isInteger(data.firstMessage) &&
    Number.isInteger(data.lastMessage)
  ) {
    return [
      {
        id,
        kind: "sequence",
        researcherId,
        firstMessage: Number(data.firstMessage),
        lastMessage: Number(data.lastMessage),
        note,
        codes,
        frameworkVersion,
        updatedAt,
      },
    ];
  }
  return [];
}

function parseReflectionComment(
  id: string,
  data: Record<string, unknown>,
  researcherId: ResearcherId,
): ResearcherReflectionComment[] {
  if (
    data.researcherId !== researcherId ||
    data.itemId !== id ||
    typeof data.comment !== "string" ||
    !(data.updatedAt instanceof Timestamp)
  ) {
    return [];
  }
  return [
    {
      researcherId,
      itemId: id,
      comment: data.comment,
      updatedAt: data.updatedAt.toDate().toISOString(),
    },
  ];
}
