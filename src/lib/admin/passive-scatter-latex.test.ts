import { describe, expect, it } from "vitest";

import {
  passivePrePostScatterLatex,
  passiveScatterLatex,
} from "./passive-scatter-latex";

const students = [
  { passive: 7, total: 10 },
  { passive: 0, total: 3 },
  { passive: 2, total: 3 },
];

describe("passiveScatterLatex", () => {
  it("gives each student's codes and share as a pgfplots table, by codes", () => {
    const latex = passiveScatterLatex(students, "all");

    expect(latex).toContain(
      [
        String.raw`      codes passive share \\`,
        String.raw`      3 0 0.00 \\`,
        String.raw`      3 2 66.67 \\`,
        String.raw`      10 7 70.00 \\`,
        String.raw`    };`,
      ].join("\n"),
    );
    expect(latex).toContain(String.raw`table[x=codes, y=share, row sep=\\]`);
  });

  it("states n and which students it rests on", () => {
    expect(passiveScatterLatex(students, "all")).toContain(
      "% n = 3: all students with P, A or C codes in lessons 1 and 2.",
    );
    expect(passiveScatterLatex(students, "allFour")).toContain(
      "% n = 3: students with AI coding in all four lessons",
    );
    expect(passiveScatterLatex(students, "all")).toContain("($n = 3$)");
  });

  it("labels the axes and escapes LaTeX's special characters", () => {
    const latex = passiveScatterLatex(students, "all");

    expect(latex).toContain(
      "xlabel={Number of behaviour codes (lessons 1--2)}",
    );
    expect(latex).toContain(String.raw`ylabel={Passive behaviours (\%)}`);
    expect(latex).toContain("ymin=0, ymax=100");
    // Only comments may hold an unescaped percent sign.
    for (const line of latex.split("\n")) {
      if (!line.startsWith("%")) expect(line).not.toMatch(/(?<!\\)%/);
    }
  });
});

const pairs = [
  { pre: { passive: 7, total: 10 }, post: { passive: 3, total: 12 } },
  { pre: { passive: 0, total: 3 }, post: { passive: 1, total: 4 } },
  { pre: { passive: 0, total: 3 }, post: { passive: 0, total: 2 } },
];

describe("passivePrePostScatterLatex", () => {
  it("gives each student's pre and post codes on one row, by codes", () => {
    const latex = passivePrePostScatterLatex(pairs, "all");

    expect(latex).toContain(
      [
        String.raw`    precodes prepassive preshare postcodes postpassive postshare \\`,
        String.raw`    3 0 0.00 2 0 0.00 \\`,
        String.raw`    3 0 0.00 4 1 25.00 \\`,
        String.raw`    10 7 70.00 12 3 25.00 \\`,
        String.raw`  }\passiveprepost`,
      ].join("\n"),
    );
  });

  it("draws a line from each pre point to its post point and marks both", () => {
    const latex = passivePrePostScatterLatex(pairs, "all");

    expect(latex).toContain(
      String.raw`quiver={u=\thisrow{postcodes}-\thisrow{precodes},`,
    );
    expect(latex).toContain(
      String.raw`v=\thisrow{postshare}-\thisrow{preshare}}`,
    );
    expect(latex).toContain(
      String.raw`table[x=postcodes, y=postshare] {\passiveprepost};`,
    );
    expect(latex).toContain(String.raw`\addlegendentry{Pre (lessons 1--2)}`);
    expect(latex).toContain(String.raw`\addlegendentry{Post (lessons 3--4)}`);
    expect(latex).toContain(String.raw`\label{fig:passive-pre-post}`);
  });

  it("states n and which students it rests on", () => {
    expect(passivePrePostScatterLatex(pairs, "all")).toContain(
      "% n = 3: all students with P, A or C codes both in lessons 1 and 2 and in lessons 3 and 4.",
    );
    expect(passivePrePostScatterLatex(pairs, "allFour")).toContain(
      "% n = 3: students with AI coding in all four lessons",
    );
    expect(passivePrePostScatterLatex(pairs, "all")).toContain("($n = 3$)");
  });

  it("escapes LaTeX's special characters outside comments", () => {
    const latex = passivePrePostScatterLatex(pairs, "all");

    expect(latex).toContain(String.raw`ylabel={Passive behaviours (\%)}`);
    for (const line of latex.split("\n")) {
      if (!line.startsWith("%")) expect(line).not.toMatch(/(?<!\\)%/);
    }
  });
});
