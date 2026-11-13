import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

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

function row(label: string) {
  return within(screen.getByRole("table"))
    .getByRole("rowheader", { name: label })
    .closest("tr") as HTMLElement;
}

function cells(label: string) {
  return within(row(label)).getAllByRole("cell").map(text);
}

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
  });
});
