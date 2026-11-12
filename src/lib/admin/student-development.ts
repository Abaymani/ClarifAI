// Each participant's P, A and C prompt codes per lesson and coder, for the
// development page (DL-079). Counted as in the AI-kodning tab (DL-074): every code
// counts at its framework level, so a prompt coded P2 and C10 adds one P and one C,
// and NA codes are not counted. A coder has coded a lesson once they have given any
// student prompt in it a code, NA included, as on the agreement page (DL-076).
import type { AgreementSessionInput, Coder } from "@/lib/admin/coder-agreement";
import {
  promptCodeLevels,
  type IcapCounts,
  type IcapLevel,
} from "@/lib/admin/icap-counts";
import {
  studyParticipantCode,
  type LessonOneCodes,
} from "@/lib/admin/lesson-one-codes";
import type { Framework } from "@/lib/analysis/framework";
import { LESSONS } from "@/lib/session/credentials";

export const DEVELOPMENT_CODERS: readonly Coder[] = ["AI", "R1", "R2"];
export const DEVELOPMENT_LEVELS: readonly IcapLevel[] = ["P", "A", "C"];

export type DevelopmentLesson =
  | { state: "noTranscript" }
  | { state: "uncoded" }
  | { state: "coded"; counts: IcapCounts };

export type StudentDevelopment = {
  participantCode: string;
  // Lessons 1–4 in order, for each coder.
  lessons: Record<Coder, DevelopmentLesson[]>;
};

export type DevelopmentScale = "share" | "count";

export function studentDevelopment(
  sessions: readonly AgreementSessionInput[],
  framework: Pick<Framework, "promptCodes">,
  lessonOneCodes: LessonOneCodes | null,
): StudentDevelopment[] {
  const levels = promptCodeLevels(framework);
  const byParticipant = new Map<string, StudentDevelopment>();

  for (const session of sessions) {
    const participantCode = studyParticipantCode(
      lessonOneCodes,
      session.participantCode,
      session.lesson,
    );
    const student = byParticipant.get(participantCode) ?? {
      participantCode,
      lessons: Object.fromEntries(
        DEVELOPMENT_CODERS.map((coder) => [
          coder,
          LESSONS.map((): DevelopmentLesson => ({ state: "noTranscript" })),
        ]),
      ) as Record<Coder, DevelopmentLesson[]>,
    };
    for (const coder of DEVELOPMENT_CODERS) {
      student.lessons[coder][session.lesson - 1] = lessonCounts(
        session,
        coder,
        levels,
      );
    }
    byParticipant.set(participantCode, student);
  }

  return [...byParticipant.values()].sort((a, b) =>
    a.participantCode.localeCompare(b.participantCode, "sv", {
      numeric: true,
    }),
  );
}

function lessonCounts(
  session: AgreementSessionInput,
  coder: Coder,
  levels: ReadonlyMap<string, string>,
): DevelopmentLesson {
  const prompts = new Set(session.prompts);
  const byPrompt = new Map<number, Set<string>>();
  for (const entry of session.coding[coder]) {
    if (!prompts.has(entry.message) || entry.codes.length === 0) continue;
    const codes = byPrompt.get(entry.message) ?? new Set();
    for (const code of entry.codes) codes.add(code);
    byPrompt.set(entry.message, codes);
  }
  if (byPrompt.size === 0) return { state: "uncoded" };

  const counts: IcapCounts = { P: 0, A: 0, C: 0 };
  for (const codes of byPrompt.values()) {
    for (const code of codes) {
      const level = levels.get(code);
      if (level === "P" || level === "A" || level === "C") counts[level] += 1;
    }
  }
  return { state: "coded", counts };
}

export function totalCodes(counts: IcapCounts): number {
  return counts.P + counts.A + counts.C;
}

// A lesson coded with only NA codes has no share to show.
export function levelValue(
  counts: IcapCounts,
  level: IcapLevel,
  scale: DevelopmentScale,
): number | null {
  if (scale === "count") return counts[level];
  const total = totalCodes(counts);
  return total === 0 ? null : counts[level] / total;
}

// From the first to the last lesson that has a value, so a participant needs two.
export function levelChange(
  lessons: readonly DevelopmentLesson[],
  level: IcapLevel,
  scale: DevelopmentScale,
): number | null {
  const values = lessons.flatMap((lesson) => {
    if (lesson.state !== "coded") return [];
    const value = levelValue(lesson.counts, level, scale);
    return value === null ? [] : [value];
  });
  return values.length < 2 ? null : values[values.length - 1] - values[0];
}
