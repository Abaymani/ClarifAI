import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { StudentDevelopmentView } from "@/app/admin/(portal)/development/student-development-view";
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
const uncoded: DevelopmentLesson = { state: "uncoded" };
const none: DevelopmentLesson = { state: "noTranscript" };

function student(
  participantCode: string,
  ai: DevelopmentLesson[],
  r2: DevelopmentLesson[] = [none, uncoded, uncoded, none],
): StudentDevelopment {
  return {
    participantCode,
    lessons: { AI: ai, R1: [none, uncoded, uncoded, none], R2: r2 },
  };
}

const students = [
  // C share 0 → 50 %.
  student("3", [
    coded(2, 0, 0),
    coded(1, 1, 0),
    coded(1, 0, 1),
    coded(1, 1, 2),
  ]),
  // C share 50 % → 0.
  student(
    "7",
    [coded(0, 1, 1), uncoded, none, coded(3, 1, 0)],
    [none, coded(0, 0, 4), uncoded, none],
  ),
  // Only one coded lesson, so no change.
  student("12", [none, coded(1, 1, 1), none, none]),
];

function cardCodes() {
  return within(screen.getByRole("list", { name: "Deltagare" }))
    .getAllByRole("heading")
    .map((heading) => heading.textContent);
}

function card(code: string) {
  return screen
    .getByRole("heading", { name: `Deltagare ${code}` })
    .closest("li") as HTMLElement;
}

describe("StudentDevelopmentView", () => {
  test("shows one card per participant, by code, with how many lessons are coded", () => {
    render(<StudentDevelopmentView students={students} />);

    expect(cardCodes()).toEqual(["Deltagare 3", "Deltagare 7", "Deltagare 12"]);
    expect(within(card("7")).getByText("2 av 4 kodade")).toBeTruthy();
  });

  test("sorts by the change in a level and puts participants without one last", () => {
    render(<StudentDevelopmentView students={students} />);

    fireEvent.change(screen.getByLabelText("Sortera"), {
      target: { value: "C" },
    });
    expect(cardCodes()).toEqual(["Deltagare 3", "Deltagare 7", "Deltagare 12"]);
    expect(within(card("3")).getByText("+50 p.e. C")).toBeTruthy();
    expect(within(card("7")).getByText("−50 p.e. C")).toBeTruthy();
    expect(
      within(card("12")).getByText("för få kodade lektioner"),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Sortera"), {
      target: { value: "P" },
    });
    // P falls from 100 % to 25 % for 3, and rises from 0 to 75 % for 7.
    expect(cardCodes()).toEqual(["Deltagare 3", "Deltagare 7", "Deltagare 12"]);

    fireEvent.click(screen.getByRole("button", { name: "Antal" }));
    expect(within(card("7")).getByText("+3 P")).toBeTruthy();
  });

  test("switches the source, and says which lessons it has not coded", () => {
    render(<StudentDevelopmentView students={students} />);

    fireEvent.click(screen.getByRole("button", { name: "Frida" }));
    expect(
      screen
        .getByRole("button", { name: "Frida" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("ingen kodning från Frida")).toBeTruthy();
    expect(within(card("7")).getByText("1 av 4 kodade")).toBeTruthy();
    expect(within(card("7")).getByRole("img").getAttribute("aria-label")).toBe(
      "Lektion 1: inget transkript. Lektion 2: P 0, A 0, C 4. Lektion 3: inte kodad av Frida. Lektion 4: inget transkript",
    );
  });

  test("draws stacked bars or one line per level", () => {
    const { container } = render(
      <StudentDevelopmentView students={[students[0]]} />,
    );
    const chart = () => container.querySelector("li svg") as SVGElement;

    // Lesson 4 has P, A and C: three segments, each with share and count.
    // Swedish percentages have a non-breaking space before the sign.
    expect(
      [...chart().querySelectorAll("rect title")].map((t) =>
        t.textContent?.replace(/\s/g, " "),
      ),
    ).toContain("Lektion 4 · C konstruktiv: 50 % (2 av 4 koder)");
    expect(chart().querySelectorAll("[data-level]")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Linjer" }));
    // Three levels across four coded lessons, each level with its own shape.
    const marker = (level: string) =>
      [...chart().querySelectorAll(`[data-level="${level}"]`)].map(
        (element) => element.tagName,
      );
    expect(marker("P")).toEqual(["circle", "circle", "circle", "circle"]);
    expect(marker("A")).toEqual(["rect", "rect", "rect", "rect"]);
    expect(marker("C")).toEqual(["path", "path", "path", "path"]);
    expect(chart().querySelectorAll("line[stroke]")).toHaveLength(9);
  });

  test("scales each card to its own data", () => {
    render(<StudentDevelopmentView students={students} />);
    const axisTop = (code: string) =>
      within(card(code))
        .getAllByText(/./, { selector: "text" })[0]
        .textContent?.replace(/\s/g, " ");

    expect(axisTop("3")).toBe("100 %");
    fireEvent.click(screen.getByRole("button", { name: "Antal" }));
    // Lesson 4 holds the most codes: 1 + 1 + 2 for 3, 3 + 1 + 0 for 7.
    expect(axisTop("3")).toBe("4");
    expect(axisTop("12")).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Linjer" }));
    // The highest single level: P 3 in lesson 4 for 7.
    expect(axisTop("7")).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Andel" }));
    // Its highest share is P at 75 % in lesson 4, rounded up to 80 %.
    expect(axisTop("7")).toBe("80 %");
  });

  test("can show only participants with all four lessons coded by the source", () => {
    render(<StudentDevelopmentView students={students} />);
    const filter = screen.getByRole("checkbox", {
      name: "Visa bara deltagare med alla fyra lektioner kodade",
    });

    expect(screen.getByText(/Visar 3 av 3 deltagare/)).toBeTruthy();
    fireEvent.click(filter);
    expect(cardCodes()).toEqual(["Deltagare 3"]);
    expect(
      screen.getByText(
        /Visar 1 av 3 deltagare, alla fyra lektioner kodade av AI/,
      ),
    ).toBeTruthy();

    // Frida has not coded all four lessons for anyone.
    fireEvent.click(screen.getByRole("button", { name: "Frida" }));
    expect(
      screen.queryAllByRole("heading", { name: /Deltagare/ }),
    ).toHaveLength(0);

    fireEvent.click(filter);
    expect(cardCodes()).toHaveLength(3);
  });

  test("dashes a line across a lesson without coding", () => {
    const { container } = render(
      <StudentDevelopmentView students={[students[1]]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Linjer" }));

    const lines = container.querySelectorAll("li svg line[stroke]");
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line.getAttribute("stroke-dasharray")).toBe("3 3");
    }
  });

  test("marks missing lessons with the same band in both charts", () => {
    const { container } = render(
      <StudentDevelopmentView students={[students[1]]} />,
    );
    const bands = () =>
      [...container.querySelectorAll('li svg [data-gap="band"]')].map(
        (gap) => gap.querySelector("title")?.textContent,
      );
    // Lesson 2 is not coded and lesson 3 has no transcript.
    const expected = [
      "Lektion 2: inte kodad av AI",
      "Lektion 3: inget transkript",
    ];

    expect(bands()).toEqual(expected);
    fireEvent.click(screen.getByRole("button", { name: "Linjer" }));
    expect(bands()).toEqual(expected);
    // No outlines that could be read as a predicted bar.
    expect(
      container.querySelectorAll("li svg [stroke-dasharray] title"),
    ).toHaveLength(0);
    expect(container.querySelectorAll("li svg rect[fill='none']")).toHaveLength(
      0,
    );
  });

  test("says when there is nothing to show", () => {
    render(<StudentDevelopmentView students={[]} />);
    expect(screen.getByText(/Inga transkript ännu/)).toBeTruthy();
  });
});
