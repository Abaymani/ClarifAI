// pgfplots scatter plots of each student's passive share against their number of
// P, A and C codes, for the researchers' report: pre alone (DL-092) and pre and
// post joined per student (DL-093). They hold counts only, never participant codes.
import type { PassiveStudents } from "@/lib/admin/passive-share";
import type { StudentCodes, StudentPair } from "@/lib/admin/passive-statistics";

const PRE_SELECTION: Record<PassiveStudents, string> = {
  all: "all students with P, A or C codes in lessons 1 and 2",
  allFour:
    "students with AI coding in all four lessons and P, A or C codes in lessons 1 and 2",
};

const PAIRED_SELECTION: Record<PassiveStudents, string> = {
  all: "all students with P, A or C codes both in lessons 1 and 2 and in lessons 3 and 4",
  allFour:
    "students with AI coding in all four lessons and P, A or C codes both in lessons 1 and 2 and in lessons 3 and 4",
};

const COLUMNS = [
  "% codes = P + A + C codes (NA not counted), passive = P codes,",
  "% share = 100 * passive / codes.",
  String.raw`% Needs \usepackage{pgfplots} and \pgfplotsset{compat=1.18} in the preamble.`,
];

// Translucent marks, so students on the same point show darker.
const PRE_MARKS = [
  String.raw`      \addplot[only marks, mark=*, mark size=2pt,`,
  String.raw`        mark options={fill=black, fill opacity=0.4, draw opacity=0.6}]`,
];

export function passiveScatterLatex(
  students: readonly StudentCodes[],
  selection: PassiveStudents,
): string {
  const n = students.length;
  // Sorted by codes, so the row order says nothing about participant codes.
  const rows = [...students]
    .sort(byCodes)
    .map((student) => `      ${columns(student)} \\\\`);

  return [
    "% Passive behaviours per student before the intervention (lessons 1 and 2),",
    "% from the ClarifAI researcher portal (Andel passivt).",
    `% n = ${n}: ${PRE_SELECTION[selection]}.`,
    ...COLUMNS,
    String.raw`\begin{figure}[htbp]`,
    String.raw`  \centering`,
    String.raw`  \begin{tikzpicture}`,
    ...axis("Number of behaviour codes (lessons 1--2)"),
    ...PRE_MARKS,
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

export function passivePrePostScatterLatex(
  pairs: readonly StudentPair[],
  selection: PassiveStudents,
): string {
  const n = pairs.length;
  // Sorted by codes, so the row order says nothing about participant codes.
  const rows = [...pairs]
    .sort((a, b) => byCodes(a.pre, b.pre) || byCodes(a.post, b.post))
    .map(({ pre, post }) => `    ${columns(pre)} ${columns(post)} \\\\`);

  return [
    "% Passive behaviours per student before (lessons 1 and 2) and after (lessons 3",
    "% and 4) the intervention, from the ClarifAI researcher portal (Andel passivt).",
    `% n = ${n}: ${PAIRED_SELECTION[selection]}.`,
    "% The pre columns are lessons 1 and 2 and the post columns lessons 3 and 4, where",
    ...COLUMNS,
    String.raw`\begin{figure}[htbp]`,
    String.raw`  \centering`,
    // Read once, since the lines and both sets of marks are drawn from it.
    String.raw`  \pgfplotstableread[row sep=\\]{`,
    String.raw`    precodes prepassive preshare postcodes postpassive postshare \\`,
    ...rows,
    String.raw`  }\passiveprepost`,
    String.raw`  \begin{tikzpicture}`,
    ...axis("Number of behaviour codes in the period", [
      String.raw`      legend style={at={(0.5,1.03)}, anchor=south, draw=none,`,
      String.raw`        /tikz/every even column/.append style={column sep=1em}},`,
      String.raw`      legend columns=2,`,
    ]),
    // A quiver plot draws one segment per row, from the pre point to the post point.
    String.raw`      \addplot[forget plot, draw=black!35,`,
    String.raw`        quiver={u=\thisrow{postcodes}-\thisrow{precodes},`,
    String.raw`          v=\thisrow{postshare}-\thisrow{preshare}}]`,
    String.raw`        table[x=precodes, y=preshare] {\passiveprepost};`,
    ...PRE_MARKS,
    String.raw`        table[x=precodes, y=preshare] {\passiveprepost};`,
    String.raw`      \addlegendentry{Pre (lessons 1--2)}`,
    String.raw`      \addplot[only marks, mark=square, mark size=1.8pt, mark options={thick}]`,
    String.raw`        table[x=postcodes, y=postshare] {\passiveprepost};`,
    String.raw`      \addlegendentry{Post (lessons 3--4)}`,
    String.raw`    \end{axis}`,
    String.raw`  \end{tikzpicture}`,
    String.raw`  \caption{Share of passive behaviours per student before (lessons 1 and 2)`,
    "    and after (lessons 3 and 4) the intervention, against their number of coded",
    `    behaviours in each period; a line joins each student's two points ($n = ${n}$).}`,
    String.raw`  \label{fig:passive-pre-post}`,
    String.raw`\end{figure}`,
    "",
  ].join("\n");
}

function axis(xlabel: string, extra: readonly string[] = []): string[] {
  return [
    String.raw`    \begin{axis}[`,
    String.raw`      width=0.9\linewidth,`,
    String.raw`      height=6cm,`,
    `      xlabel={${xlabel}},`,
    String.raw`      ylabel={Passive behaviours (\%)},`,
    String.raw`      xmin=0,`,
    String.raw`      ymin=0, ymax=100,`,
    String.raw`      ytick={0,25,50,75,100},`,
    String.raw`      grid=major,`,
    ...extra,
    String.raw`    ]`,
  ];
}

function byCodes(a: StudentCodes, b: StudentCodes): number {
  return a.total - b.total || a.passive - b.passive;
}

function columns({ passive, total }: StudentCodes): string {
  return `${total} ${passive} ${((100 * passive) / total).toFixed(2)}`;
}
