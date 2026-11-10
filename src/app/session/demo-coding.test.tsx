import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Framework, FrameworkEntry } from "@/lib/analysis/framework";
import type { Coding } from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";

import { DemoCoding } from "./demo-coding";

const entry = (code: string, name: string, level?: string) =>
  ({ code, name, ...(level ? { level } : {}) }) as FrameworkEntry;

const framework: Pick<Framework, "promptCodes" | "sequencePatterns"> = {
  promptCodes: [
    entry("NA3", "Code generation", "NA"),
    entry("P1", "Decision delegation", "P"),
    entry("A3", "Asks for a reason", "A"),
    entry("C5", "Presents a hypothesis", "C"),
  ],
  sequencePatterns: [entry("S1", "Takes back the initiative")],
};

const messages: TranscriptMessage[] = [
  { index: 1, role: "student", text: "Which loop should I use?" },
  { index: 2, role: "gemini", text: "A for loop." },
  {
    index: 3,
    role: "student",
    text: "I think it fails because i starts at 1.",
  },
  { index: 4, role: "gemini", text: "Yes." },
  { index: 5, role: "student", text: "Thanks" },
];

const coding: Coding = {
  prompts: [
    {
      message: 1,
      codes: [
        {
          code: "P1",
          excerpt: "Which loop should I use?",
          justification: "Leaves the choice to Gemini.",
        },
        {
          code: "NA3",
          excerpt: "loop",
          justification: "Asks about code.",
        },
      ],
      note: null,
    },
    {
      message: 3,
      codes: [
        {
          code: "C5",
          excerpt: "it fails because",
          justification: "Offers an explanation of their own.",
        },
      ],
      note: null,
    },
    { message: 5, codes: [], note: "Too short to code." },
  ],
  sequences: [
    {
      pattern: "S1",
      firstMessage: 1,
      lastMessage: 3,
      excerptMessage: 3,
      excerpt: "I think",
      justification: "Takes over after asking.",
    },
  ],
};

describe("DemoCoding", () => {
  it("shows every prompt with the AI's codes and reasons", () => {
    const { container } = render(
      <DemoCoding
        messages={messages}
        analysis={coding}
        framework={framework}
      />,
    );

    const prompts = container.querySelectorAll("ol > li");
    expect(prompts).toHaveLength(3);
    expect(container.textContent).not.toContain("A for loop.");

    expect(
      prompts[0].querySelector('[data-chat-role="student"]')?.textContent,
    ).toContain("Which loop should I use?");
    const first = within(prompts[0] as HTMLElement);
    expect(first.getByText("Decision delegation")).toBeTruthy();
    expect(first.getByText("Code generation")).toBeTruthy();
    expect(first.getByText("Leaves the choice to Gemini.")).toBeTruthy();

    expect(
      within(prompts[1] as HTMLElement).getByText("Presents a hypothesis"),
    ).toBeTruthy();
    expect(
      within(prompts[2] as HTMLElement).getByText("Too short to code."),
    ).toBeTruthy();
  });

  it("counts codes per ICAP level, leaving NA out", () => {
    render(
      <DemoCoding
        messages={messages}
        analysis={coding}
        framework={framework}
      />,
    );

    const summary = screen.getByLabelText("Koder per ICAP-nivå");
    const count = (level: string) =>
      within(summary).getByText(level).nextElementSibling?.textContent;
    expect(count("P")).toBe("1");
    expect(count("A")).toBe("0");
    expect(count("C")).toBe("1");
  });

  it("lists patterns across prompts, or says there are none", () => {
    const { rerender } = render(
      <DemoCoding
        messages={messages}
        analysis={coding}
        framework={framework}
      />,
    );
    expect(screen.getByText("Takes back the initiative")).toBeTruthy();
    expect(screen.getByText(/Meddelande 1–3/)).toBeTruthy();

    rerender(
      <DemoCoding
        messages={messages}
        analysis={{ ...coding, sequences: [] }}
        framework={framework}
      />,
    );
    expect(
      screen.getByText("AI:n hittade inga mönster över flera prompter."),
    ).toBeTruthy();
  });

  it("says when a prompt has no stored coding at all", () => {
    render(
      <DemoCoding
        messages={messages.slice(0, 1)}
        analysis={{ prompts: [], sequences: [] }}
        framework={framework}
      />,
    );
    expect(screen.getByText("Inga koder för den här prompten.")).toBeTruthy();
  });
});
