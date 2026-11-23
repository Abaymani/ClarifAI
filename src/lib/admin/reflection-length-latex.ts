// A LaTeX table of how many words the students wrote in their reflections, for
// the researchers' report (DL-094). It holds means and SDs only, never
// participant codes.
import { jStat } from "jstat";

import {
  averageWords,
  pooledMoments,
  totalWords,
} from "@/lib/admin/reflection-words";
import type {
  AdminParticipantOverview,
  AdminReflectionWords,
} from "@/lib/admin/types";

// Students only reflect in lessons 2 and 3.
const LESSONS = [2, 3] as const;

type Row = { label: string; totals: number[]; perMoment: number[] };
type Submitted = Extract<AdminReflectionWords, { state: "submitted" }>;

export function reflectionLengthLatex(
  participants: readonly AdminParticipantOverview[],
): string {
  const rows: Row[] = [
    { label: "Lesson 2", totals: [], perMoment: [] },
    { label: "Lesson 3", totals: [], perMoment: [] },
    { label: "Lessons 2 and 3", totals: [], perMoment: [] },
  ];
  for (const participant of participants) {
    const words = LESSONS.map(
      (lesson) => participant.sessions[lesson]?.reflectionWords,
    );
    words.forEach((lesson, index) => {
      if (hasMoments(lesson)) add(rows[index], lesson.moments);
    });
    // Only students with both, so the total always covers two reflections.
    if (words.every(hasMoments)) add(rows[2], pooledMoments(words));
  }

  return [
    "% Words in the students' reflections, from the ClarifAI researcher portal",
    "% (Reflektionslängd), for every participant.",
    "% Lesson 2 and Lesson 3: every student with a submitted reflection in that lesson.",
    "% Lessons 2 and 3: only students who submitted both, with their words in both",
    "% reflections and their words per moment over all moments of both.",
    "% Total words = a student's words over every moment of the reflection;",
    "% words per moment = that total divided by the number of moments.",
    "% A word is text between spaces with at least one letter or digit.",
    "% M = mean and SD = sample standard deviation, over students.",
    String.raw`% Needs \usepackage{booktabs} in the preamble. Without \usepackage{caption},`,
    "% the standard classes leave no space between the caption and the table.",
    String.raw`\begin{table}[htbp]`,
    String.raw`  \centering`,
    String.raw`  \caption{Words in the students' reflections, per lesson and for the students`,
    "    who submitted reflections in both lessons.}",
    String.raw`  \label{tab:reflection-length}`,
    String.raw`  \begin{tabular}{lrrr}`,
    String.raw`    \toprule`,
    String.raw`     & & Total words & Words per moment \\`,
    String.raw`     & $n$ & \textit{M} (\textit{SD}) & \textit{M} (\textit{SD}) \\`,
    String.raw`    \midrule`,
    ...rows.map(
      ({ label, totals, perMoment }) =>
        `    ${label} & ${totals.length} & ${meanSd(totals)} & ${meanSd(perMoment)} \\\\`,
    ),
    String.raw`    \bottomrule`,
    String.raw`  \end{tabular}`,
    String.raw`\end{table}`,
    "",
  ].join("\n");
}

// Students cannot submit an empty answer, but a lesson can have no moments.
function hasMoments(
  words: AdminReflectionWords | undefined,
): words is Submitted {
  return words?.state === "submitted" && words.moments.length > 0;
}

function add(row: Row, moments: readonly number[]) {
  row.totals.push(totalWords(moments));
  row.perMoment.push(averageWords(moments) ?? 0);
}

function meanSd(values: readonly number[]): string {
  if (values.length === 0) return "--";
  const mean = jStat.mean(values).toFixed(1);
  // A single student has no spread.
  const sd = values.length < 2 ? "--" : jStat.stdev(values, true).toFixed(1);
  return `${mean} (${sd})`;
}
