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
  coding: {
    R1: [
      {
        id: "prompt-1",
        kind: "prompt" as const,
        researcherId: "R1" as const,
        message: 1,
        note: "Armins anteckning",
        codes: ["C2"],
        frameworkVersion: "test",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
    ],
    R2: [
      {
        id: "prompt-1",
        kind: "prompt" as const,
        researcherId: "R2" as const,
        message: 1,
        note: "Fridas anteckning",
        codes: ["A6"],
        frameworkVersion: "test",
        updatedAt: "2026-10-05T00:00:00.000Z",
      },
    ],
  },
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

  test("shows AI, Armin, and Frida prompt codes only when opted in", () => {
    render(<TranscriptWorkspace {...props} />);

    const ai = screen.getByRole("button", {
      name: "Visa AI-koder i transkriptet",
    });
    const armin = screen.getByRole("button", {
      name: "Visa Armin-koder i transkriptet",
    });
    const frida = screen.getByRole("button", {
      name: "Visa Frida-koder i transkriptet",
    });
    expect(ai.getAttribute("aria-pressed")).toBe("false");
    expect(armin.getAttribute("aria-pressed")).toBe("false");
    expect(frida.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText("AI · A6")).toBeNull();
    expect(screen.queryByText("Armin · C2")).toBeNull();
    expect(screen.queryByText("Frida · A6")).toBeNull();

    fireEvent.click(ai);
    fireEvent.click(armin);
    fireEvent.click(frida);
    expect(screen.getByText("AI · A6")).toBeTruthy();
    expect(screen.getByText("Armin · C2")).toBeTruthy();
    expect(screen.getByText("Frida · A6")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Armin (du)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Frida" })).toBeTruthy();
  });
});
