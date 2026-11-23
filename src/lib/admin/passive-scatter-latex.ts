// A pgfplots scatter plot of each student's passive share against their number of
// P, A and C codes before the interaction, for the researchers' report (DL-092).
// It holds counts only, never participant codes.
import type { PassiveStudents } from "@/lib/admin/passive-share";
import type { StudentCodes } from "@/lib/admin/passive-statistics";

const SELECTION: Record<PassiveStudents, string> = {
  all: "all students with P, A or C codes in lessons 1 and 2",
  allFour:
    "students with AI coding in all four lessons and P, A or C codes in lessons 1 and 2",
};

export function passiveScatterLatex(
  students: readonly StudentCodes[],
  selection: PassiveStudents,
): string {
  const n = students.length;
  // Sorted by codes, so the row order says nothing about participant codes.
  const rows = [...students]
    .sort((a, b) => a.total - b.total || a.passive - b.passive)
    .map(
      ({ passive, total }) =>
        `      ${total} ${passive} ${((100 * passive) / total).toFixed(2)} \\\\`,
    );

  return [
    "% Passive behaviours per student before the intervention (lessons 1 and 2),",
    "% from the ClarifAI researcher portal (Andel passivt).",
    `% n = ${n}: ${SELECTION[selection]}.`,
    "% codes = P + A + C codes (NA not counted), passive = P codes,",
    "% share = 100 * passive / codes.",
    String.raw`% Needs \usepackage{pgfplots} and \pgfplotsset{compat=1.18} in the preamble.`,
    String.raw`\begin{figure}[htbp]`,
    String.raw`  \centering`,
    String.raw`  \begin{tikzpicture}`,
    String.raw`    \begin{axis}[`,
    String.raw`      width=0.9\linewidth,`,
    String.raw`      height=6cm,`,
    String.raw`      xlabel={Number of behaviour codes (lessons 1--2)},`,
    String.raw`      ylabel={Passive behaviours (\%)},`,
    String.raw`      xmin=0,`,
    String.raw`      ymin=0, ymax=100,`,
    String.raw`      ytick={0,25,50,75,100},`,
    String.raw`      grid=major,`,
    String.raw`    ]`,
    // Translucent marks, so students on the same point show darker.
    String.raw`      \addplot[only marks, mark=*, mark size=2pt,`,
    String.raw`        mark options={fill=black, fill opacity=0.4, draw opacity=0.6}]`,
    String.raw`        table[x=codes, y=share, row sep=\\] {`,
    String.raw`      codes passive share \\`,
    ...rows,
    String.raw`    };`,
    String.raw`    \end{axis}`,
    String.raw`  \end{tikzpicture}`,
    String.raw`  \caption{Share of passive behaviours per student before the intervention`,
    `    (lessons 1 and 2), against their number of coded behaviours ($n = ${n}$).}`,
    String.raw`  \label{fig:passive-pre}`,
    String.raw`\end{figure}`,
    "",
  ].join("\n");
}
