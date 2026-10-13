// Some participants were given new codes after lesson 1, so their lesson 1 is
// stored under another code than lessons 2–4. The researchers keep the mapping in
// one database document; the portal only uses it to decide under which participant
// a lesson 1 is shown, and never changes a session (DL-072).
import { normaliseParticipantCode } from "@/lib/session/credentials";

export const LESSON_ONE_CODES_COLLECTION = "codeMappings";
export const LESSON_ONE_CODES_DOC = "lessonOne";

export type LessonOneCodes = {
  // Code typed in lesson 1 → the participant's code in lessons 2–4.
  toStudyCode: ReadonlyMap<string, string>;
  // Code in lessons 2–4 → the code that participant typed in lesson 1.
  toLessonOneCode: ReadonlyMap<string, string>;
};

export type LessonOneCodesProblem =
  // Not a map of participant codes.
  | { kind: "format" }
  // Two lesson 1 codes point to the same participant.
  | { kind: "duplicate"; code: string }
  // A participant who has a lesson 1 of their own would get a second one.
  | { kind: "conflict"; code: string };

export type LessonOneCodesState =
  | { status: "none" }
  | { status: "applied"; codes: LessonOneCodes }
  | { status: "ignored"; problem: LessonOneCodesProblem };

export function parseLessonOneCodes(
  value: unknown,
):
  | { ok: true; codes: LessonOneCodes }
  | { ok: false; problem: LessonOneCodesProblem } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, problem: { kind: "format" } };
  }
  const toStudyCode = new Map<string, string>();
  const toLessonOneCode = new Map<string, string>();
  for (const [rawFrom, rawTo] of Object.entries(value)) {
    const from = participantCode(rawFrom);
    const to = participantCode(rawTo);
    if (!from || !to || toStudyCode.has(from)) {
      return { ok: false, problem: { kind: "format" } };
    }
    if (toLessonOneCode.has(to)) {
      return { ok: false, problem: { kind: "duplicate", code: to } };
    }
    toStudyCode.set(from, to);
    toLessonOneCode.set(to, from);
  }
  if (toStudyCode.size === 0) return { ok: false, problem: { kind: "format" } };
  return { ok: true, codes: { toStudyCode, toLessonOneCode } };
}

// The participant a session belongs to.
export function studyParticipantCode(
  codes: LessonOneCodes | null,
  participantCode: string,
  lesson: number,
): string {
  if (lesson !== 1 || !codes) return participantCode;
  return codes.toStudyCode.get(participantCode) ?? participantCode;
}

// The code a participant's session for this lesson is stored under, or null when
// the lesson 1 stored under their code belongs to another participant.
export function storedParticipantCode(
  codes: LessonOneCodes | null,
  participantCode: string,
  lesson: number,
): string | null {
  if (lesson !== 1 || !codes) return participantCode;
  const lessonOneCode = codes.toLessonOneCode.get(participantCode);
  if (lessonOneCode) return lessonOneCode;
  return codes.toStudyCode.has(participantCode) ? null : participantCode;
}

// Codes from lessons 2–4 that were not used in lesson 1 by anyone in the mapping.
// If one of them has a lesson 1 of its own, the mapping would give that
// participant two.
export function codesToCheckForOwnLessonOne(codes: LessonOneCodes): string[] {
  return [...codes.toLessonOneCode.keys()].filter(
    (code) => !codes.toStudyCode.has(code),
  );
}

// The researchers' sheet: a header row, then one "lesson 1 code,lessons 2–4 code"
// row per participant.
export function lessonOneCodesFromCsv(text: string): Record<string, string> {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const mapping: Record<string, string> = {};
  for (const [index, row] of rows.entries()) {
    const cells = row.split(",").map((cell) => cell.trim());
    if (index === 0 && cells.some((cell) => !/^\d+$/.test(cell))) continue;
    const from = cells.length === 2 ? participantCode(cells[0]) : null;
    const to = cells.length === 2 ? participantCode(cells[1]) : null;
    if (!from || !to) {
      throw new Error(`Row ${index + 1} is not two participant codes: ${row}`);
    }
    if (from in mapping) {
      throw new Error(`Lesson 1 code ${from} appears twice.`);
    }
    mapping[from] = to;
  }
  return mapping;
}

function participantCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    return normaliseParticipantCode(String(value));
  } catch {
    return null;
  }
}
