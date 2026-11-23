// The group's share of passive codes in the AI coding, per lesson and pre and post
// interaction (DL-080). P codes ÷ (P + A + C) codes, so a prompt coded P
// and C counts as one P and one C, and NA codes are left out, as in DL-074.
import type { IcapCounts } from "@/lib/admin/icap-counts";
import {
  pairedChange,
  shareStatistics,
  type PairedChange,
  type ShareStatistics,
  type StudentCodes,
} from "@/lib/admin/passive-statistics";
import {
  totalCodes,
  type StudentDevelopment,
} from "@/lib/admin/student-development";

// Mean: each student's share first, then their average, so every student weighs
// the same. Pooled: all P codes over all codes, so students who prompt more weigh
// more.
export type PassiveAggregation = "mean" | "pooled";
// All students with AI coding in the period, or only those with AI coding in all
// four lessons, so that every figure rests on the same students.
export type PassiveStudents = "all" | "allFour";

export type PassiveFigure = {
  // Null when no student has a P, A or C code in the period.
  share: number | null;
  students: number;
  codes: number;
  // Prompts with at least one P, A or C code; one prompt can carry several codes.
  prompts: number;
  // Each included student's own share, for the dots in the chart.
  studentShares: number[];
  // Each included student's P and P + A + C codes, without participant codes, for
  // the LaTeX scatter plot (DL-092).
  studentCodes: StudentCodes[];
};

export type PassiveShare = {
  lessons: PassiveFigure[];
  // Pre-interaction: lessons 1 and 2.
  pre: PassiveFigure;
  // Post-interaction: lessons 3 and 4.
  post: PassiveFigure;
  // Post minus pre; null when either is missing.
  change: number | null;
  // For reporting the pre and post figures (DL-091).
  statistics: {
    pre: ShareStatistics;
    post: ShareStatistics;
    // Each student against themself, so only students with codes in both.
    change: PairedChange;
  };
};

export const PRE_LESSONS = [1, 2] as const;
export const POST_LESSONS = [3, 4] as const;

export function passiveShare(
  students: readonly StudentDevelopment[],
  aggregation: PassiveAggregation,
  selection: PassiveStudents,
): PassiveShare {
  const included =
    selection === "allFour"
      ? students.filter((student) =>
          student.lessons.AI.every((lesson) => lesson.state === "coded"),
        )
      : students;

  const preStudents = periodCodes(included, PRE_LESSONS);
  const postStudents = periodCodes(included, POST_LESSONS);
  const pre = figure(preStudents, aggregation);
  const post = figure(postStudents, aggregation);
  const postByStudent = new Map(
    postStudents.map((student) => [student.participantCode, student]),
  );
  return {
    lessons: [1, 2, 3, 4].map((lesson) =>
      figure(periodCodes(included, [lesson]), aggregation),
    ),
    pre,
    post,
    change:
      pre.share === null || post.share === null ? null : post.share - pre.share,
    statistics: {
      pre: shareStatistics(preStudents, aggregation),
      post: shareStatistics(postStudents, aggregation),
      change: pairedChange(
        preStudents.flatMap((student) => {
          const after = postByStudent.get(student.participantCode);
          return after ? [{ pre: student, post: after }] : [];
        }),
      ),
    },
  };
}

type PeriodCodes = StudentCodes & { participantCode: string; prompts: number };

// Each student's codes from every lesson of the period, pooled before their share
// is taken; a student with coding in only one of the lessons still counts.
// Students with no P, A or C code in the period are left out.
function periodCodes(
  students: readonly StudentDevelopment[],
  lessons: readonly number[],
): PeriodCodes[] {
  return students.flatMap((student) => {
    const counts: IcapCounts = { P: 0, A: 0, C: 0 };
    let prompts = 0;
    for (const lesson of lessons) {
      const coded = student.lessons.AI[lesson - 1];
      if (coded?.state !== "coded") continue;
      counts.P += coded.counts.P;
      counts.A += coded.counts.A;
      counts.C += coded.counts.C;
      prompts += coded.codedPrompts;
    }
    const total = totalCodes(counts);
    return total === 0
      ? []
      : [
          {
            participantCode: student.participantCode,
            passive: counts.P,
            total,
            prompts,
          },
        ];
  });
}

function figure(
  perStudent: readonly PeriodCodes[],
  aggregation: PassiveAggregation,
): PassiveFigure {
  const codes = perStudent.reduce((sum, student) => sum + student.total, 0);
  const prompts = perStudent.reduce((sum, student) => sum + student.prompts, 0);
  const studentShares = perStudent.map(
    (student) => student.passive / student.total,
  );
  let share: number | null = null;
  if (perStudent.length > 0) {
    share =
      aggregation === "mean"
        ? studentShares.reduce((sum, value) => sum + value, 0) /
          studentShares.length
        : perStudent.reduce((sum, student) => sum + student.passive, 0) / codes;
  }
  return {
    share,
    students: perStudent.length,
    codes,
    prompts,
    studentShares,
    studentCodes: perStudent.map(({ passive, total }) => ({ passive, total })),
  };
}
