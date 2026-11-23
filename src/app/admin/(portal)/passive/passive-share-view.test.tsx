import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { PassiveShareView } from "@/app/admin/(portal)/passive/passive-share-view";
import type {
  DevelopmentLesson,
  StudentDevelopment,
} from "@/lib/admin/student-development";

// Unless given, every code is taken to sit on a prompt of its own.
const coded = (
  P: number,
  A: number,
  C: number,
  codedPrompts = P + A + C,
): DevelopmentLesson => ({
  state: "coded",
  counts: { P, A, C },
  codedPrompts,
});
const none: DevelopmentLesson = { state: "noTranscript" };

function student(code: string, ai: DevelopmentLesson[]): StudentDevelopment {
  return {
    participantCode: code,
    lessons: {
      AI: ai,
      R1: [none, none, none, none],
      R2: [none, none, none, none],
    },
    reflectionWords: {},
  };
}

const students = [
  // Pre 14 of 20, post 6 of 20.
  student("1", [
    coded(8, 2, 0),
    coded(6, 2, 2),
    coded(4, 4, 2),
    coded(2, 4, 4),
  ]),
  // Pre 0 of 2, post 0 of 2; no lesson 2 or 4.
  student("2", [coded(0, 1, 1), none, coded(0, 1, 1), none]),
];

// Swedish numbers have non-breaking spaces before % and in large numbers.
const text = (element: Element) =>
  element.textContent?.replace(/\s/g, " ").trim();

function tile(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

function row(label: string, table = "Andel passiva koder per lektion") {
  return within(screen.getByRole("table", { name: table }))
    .getByRole("rowheader", { name: label })
    .closest("tr") as HTMLElement;
}

function cells(label: string, table?: string) {
  return within(row(label, table)).getAllByRole("cell").map(text);
}

const statistics = (label: string) =>
  cells(label, "Statistik för pre och post");

function figure(label: string) {
  const change = screen.getByRole("heading", {
    name: "Förändring per elev, pre till post",
  }).parentElement as HTMLElement;
  return text(within(change).getByText(label).parentElement as HTMLElement);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  return writeText;
}

const COPY = { name: /Kopiera spridningsdiagram för pre \(LaTeX\)/ };
const COPY_PAIRED = {
  name: /Kopiera spridningsdiagram för pre och post/,
};

describe("PassiveShareView", () => {
  test("shows pre, post and the change, averaged per student", () => {
    render(<PassiveShareView students={students} />);

    expect(text(tile("Pre-interaktion"))).toContain("35,0 %");
    expect(text(tile("Pre-interaktion"))).toContain("2 elever · 22 koder");
    expect(text(tile("Post-interaktion"))).toContain("15,0 %");
    expect(text(tile("Förändring"))).toContain("−20,0 p.e.");
    expect(cells("Andel passivt")).toEqual([
      "40,0 %",
      "60,0 %",
      "20,0 %",
      "20,0 %",
      "35,0 %",
      "15,0 %",
    ]);
    expect(cells("Elever")).toEqual(["2", "1", "2", "1", "2", "2"]);
    expect(cells("Koder")).toEqual(["12", "10", "12", "10", "22", "22"]);
    expect(cells("Promptar")).toEqual(["12", "10", "12", "10", "22", "22"]);
    expect(
      screen.getByText(/Promptar räknar promptar med minst en/),
    ).toBeTruthy();
  });

  test("can pool all codes instead", () => {
    render(<PassiveShareView students={students} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Alla koder sammanslagna" }),
    );

    // 14 of 22 and 6 of 22.
    expect(cells("Andel passivt").slice(4)).toEqual(["63,6 %", "27,3 %"]);
    expect(text(tile("Förändring"))).toContain("−36,4 p.e.");
    expect(screen.getByText(/elever med fler koder väger mer/)).toBeTruthy();
  });

  test("can keep only students with AI coding in all four lessons", () => {
    render(<PassiveShareView students={students} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Bara alla fyra lektioner" }),
    );

    expect(cells("Elever")).toEqual(["1", "1", "1", "1", "1", "1"]);
    expect(cells("Andel passivt").slice(4)).toEqual(["70,0 %", "30,0 %"]);
    expect(
      screen
        .getByRole("button", { name: "Bara alla fyra lektioner" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  test("draws a dot per student and a point per lesson", () => {
    const { container } = render(<PassiveShareView students={students} />);

    expect(container.querySelectorAll("svg [data-student]")).toHaveLength(6);
    expect(
      [...container.querySelectorAll("svg [data-group] title")].map(text),
    ).toEqual([
      "Lektion 1: 40 % passivt, 2 elever",
      "Lektion 2: 60 % passivt, 1 elev",
      "Lektion 3: 20 % passivt, 2 elever",
      "Lektion 4: 20 % passivt, 1 elev",
    ]);
  });

  test("shows dashes when there is nothing to count", () => {
    render(<PassiveShareView students={[]} />);

    expect(text(tile("Pre-interaktion"))).toContain("–");
    expect(text(tile("Förändring"))).toContain("–");
    expect(cells("Elever")).toEqual(["0", "0", "0", "0", "0", "0"]);
    expect(statistics("Standardavvikelse (SD)")).toEqual(["–", "–"]);
    expect(figure("Parat t-test")).toContain("t–");
  });

  test("gives the spread and intervals of pre and post", () => {
    render(<PassiveShareView students={students} />);

    // Pre shares 70 % and 0 %, post 30 % and 0 %.
    expect(statistics("Andel passivt")).toEqual(["35,0 %", "15,0 %"]);
    expect(statistics("Standardavvikelse (SD)")).toEqual([
      "49,5 p.e.",
      "21,2 p.e.",
    ]);
    expect(statistics("Standardfel (SE)")).toEqual(["35,0 p.e.", "15,0 p.e."]);
    expect(statistics("Median")).toEqual(["35,0 %", "15,0 %"]);
    expect(statistics("Kvartiler (Q1; Q3)")).toEqual([
      "[17,5 %; 52,5 %]",
      "[7,5 %; 22,5 %]",
    ]);
    expect(statistics("Elever (n)")).toEqual(["2", "2"]);
    expect(screen.getByText(/bygger på t-fördelningen/)).toBeTruthy();
  });

  test("compares each student's pre and post", () => {
    render(<PassiveShareView students={students} />);

    // Student 1 went from 70 % to 30 % and student 2 stayed at 0 %.
    expect(figure("Medelförändring")).toContain("−20,0 p.e.");
    expect(figure("Parat t-test")).toContain("t(1) = −1,00");
    expect(figure("Parat t-test")).toContain("p = 0,500");
    expect(figure("Parat t-test")).toContain("Cohens dz = −0,71");
    expect(figure("Wilcoxons teckenrangtest")).toContain("z = −1,00");
    expect(figure("Wilcoxons teckenrangtest")).toContain("p = 0,317");
    expect(figure("Wilcoxons teckenrangtest")).toContain("rrb = −1,00");
    expect(figure("Elever")).toContain("1 ned · 1 lika · 0 upp");
    expect(
      screen.getByText(/utan kontinuitetskorrektion, som SPSS/),
    ).toBeTruthy();
  });

  test("clusters the pooled share's interval and says so", () => {
    render(<PassiveShareView students={students} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Alla koder sammanslagna" }),
    );

    expect(statistics("Andel passivt")).toEqual(["63,6 %", "27,3 %"]);
    // The spread among students does not depend on how the group is counted.
    expect(statistics("Standardavvikelse (SD)")).toEqual([
      "49,5 p.e.",
      "21,2 p.e.",
    ]);
    expect(screen.getByText(/klustrade per elev/)).toBeTruthy();
    expect(
      screen.getByText(/också när koderna räknas sammanslagna/),
    ).toBeTruthy();
  });

  test("copies a LaTeX scatter plot of pre with counts only", async () => {
    const writeText = stubClipboard();
    render(<PassiveShareView students={students} />);

    fireEvent.click(screen.getByRole("button", COPY));

    await waitFor(() => expect(screen.getByText("Kopierat")).toBeTruthy());
    const latex = writeText.mock.calls[0][0] as string;
    // Student 2 has 0 P of 2 codes and student 1 14 P of 20.
    expect(latex).toContain(
      [String.raw`      2 0 0.00 \\`, String.raw`      20 14 70.00 \\`].join(
        "\n",
      ),
    );
    expect(latex).toContain("% n = 2: all students");
  });

  test("copies only the students chosen under Elever", async () => {
    const writeText = stubClipboard();
    render(<PassiveShareView students={students} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Bara alla fyra lektioner" }),
    );

    fireEvent.click(screen.getByRole("button", COPY));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const latex = writeText.mock.calls[0][0] as string;
    expect(latex).toContain("% n = 1: students with AI coding in all four");
    expect(latex).not.toContain("      2 0 0.00");
  });

  test("says so when the clipboard is blocked", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    });
    render(<PassiveShareView students={students} />);

    fireEvent.click(screen.getByRole("button", COPY));

    await waitFor(() =>
      expect(screen.getByText("Kunde inte kopiera")).toBeTruthy(),
    );
  });

  test("offers no scatter plot without students before the interaction", () => {
    render(<PassiveShareView students={[]} />);

    expect(screen.queryByRole("button", COPY)).toBeNull();
    expect(screen.queryByRole("button", COPY_PAIRED)).toBeNull();
  });

  test("copies a LaTeX scatter plot joining each student's pre and post", async () => {
    const writeText = stubClipboard();
    render(
      <PassiveShareView
        students={[
          ...students,
          // Only pre, so left out of the plot that joins pre and post.
          student("3", [coded(1, 1, 0), none, none, none]),
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", COPY_PAIRED));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const latex = writeText.mock.calls[0][0] as string;
    expect(latex).toContain(
      [
        String.raw`    2 0 0.00 2 0 0.00 \\`,
        String.raw`    20 14 70.00 20 6 30.00 \\`,
        String.raw`  }\passiveprepost`,
      ].join("\n"),
    );
    expect(latex).toContain("% n = 2: all students with P, A or C codes both");
  });
});
