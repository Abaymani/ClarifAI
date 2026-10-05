import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/admin/(portal)/coding-actions", () => ({
  savePromptCodingAction: vi.fn(),
  saveSequenceCodingAction: vi.fn(),
  deleteSequenceCodingAction: vi.fn(),
}));

import { TranscriptWorkspace } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/transcript-workspace";

const props = {
  sessionId: "12_2",
  messages: [
    { index: 1, role: "student" as const, text: "Jag testade pin 8." },
    { index: 2, role: "gemini" as const, text: "Bra, vad hände?" },
  ],
  analysis: {
    frameworkVersion: "test",
    frameworkStatus: "ACTIVE",
    analyser: "fake" as const,
    model: null,
    reasoningEffort: null,
    createdAt: "2026-10-05T00:00:00.000Z",
    durationMs: 1,
    usage: null,
    prompts: [
      {
        message: 1,
        codes: [
          {
            code: "A6",
            excerpt: "Jag testade pin 8.",
            justification: "Prompten beskriver ett konkret försök.",
          },
        ],
        note: null,
      },
    ],
    sequences: [],
  },
  coding: { R1: [], R2: [] },
  currentResearcher: "R1" as const,
  codeOptions: [
    {
      code: "A6",
      name: "Precis rapportering",
      description: "Noggrann beskrivning",
      examples: ["Exempel"],
      kind: "prompt" as const,
    },
  ],
};

describe("TranscriptWorkspace", () => {
  beforeEach(() => vi.clearAllMocks());

  test("keeps AI coding hidden by default and reveals stored motivation", () => {
    render(<TranscriptWorkspace {...props} />);
    expect(screen.queryByText("Precis rapportering")).toBeNull();

    fireEvent.click(screen.getByLabelText("Visa AI-kodning"));
    const title = screen.getByText("Precis rapportering");
    const details = title.closest("details");
    expect(details?.open).toBe(false);

    fireEvent.click(title.closest("summary")!);
    expect(details?.open).toBe(true);
    expect(
      screen.getByText("Prompten beskriver ett konkret försök."),
    ).toBeTruthy();
  });

  test("searches stored framework codes without AI", () => {
    render(<TranscriptWorkspace {...props} />);
    fireEvent.change(
      screen.getByPlaceholderText("Sök kod, beskrivning eller exempel"),
      { target: { value: "noggrann" } },
    );
    expect(screen.getByText("A6 · Precis rapportering")).toBeTruthy();
  });
});
