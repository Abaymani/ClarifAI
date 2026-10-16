import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/admin/(portal)/coding-actions", () => ({
  savePromptCodingAction: vi.fn(),
  saveSequenceCodingAction: vi.fn(),
  deleteSequenceCodingAction: vi.fn(),
}));

import {
  savePromptCodingAction,
  saveSequenceCodingAction,
} from "@/app/admin/(portal)/coding-actions";
import { TranscriptWorkspace } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/transcript-workspace";
import type { ResearcherPromptCoding } from "@/lib/admin/types";

const props = {
  sessionId: "12_2",
  participantCode: "12",
  messages: [
    { index: 1, role: "student" as const, text: "Jag testade pin 8." },
    { index: 2, role: "gemini" as const, text: "Bra, vad hände?" },
    {
      index: 3,
      role: "student" as const,
      text: "Jag jämförde med kopplingsschemat.",
    },
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
    sequences: [
      {
        pattern: "S3",
        firstMessage: 1,
        lastMessage: 2,
        excerptMessage: 1,
        excerpt: "Jag testade pin 8.",
        justification: "Meddelandena bildar ett sammanhängande förlopp.",
      },
    ],
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
      {
        id: "sequence-12345678",
        kind: "sequence" as const,
        researcherId: "R1" as const,
        firstMessage: 1,
        lastMessage: 2,
        note: "Armins sekvens",
        codes: ["S7"],
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
    {
      code: "C2",
      name: "Egen hypotes",
      description: "Eleven formulerar en hypotes",
      examples: ["Exempel"],
      kind: "prompt" as const,
    },
    {
      code: "S3",
      name: "Direkt-svarssökande förlopp",
      description: "Eleven följer AI:s svar",
      examples: ["Exempel"],
      kind: "sequence" as const,
    },
    {
      code: "S7",
      name: "Produktiv samkonstruktion",
      description: "Eleven och AI utvecklar resonemanget tillsammans",
      examples: ["Exempel"],
      kind: "sequence" as const,
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
    expect(
      screen.getAllByText("A6 · Precis rapportering").length,
    ).toBeGreaterThan(0);
  });

  test("shows AI, Armin, and Frida prompt codes only when opted in", () => {
    render(<TranscriptWorkspace {...props} />);

    expect(screen.getByText("1. Deltagare 12")).toBeTruthy();
    expect(screen.getByText("2. Gemini")).toBeTruthy();
    expect(screen.queryByText("1. Du")).toBeNull();

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
    expect(
      screen.getAllByText("A6 · Precis rapportering").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Armin (du)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Frida" })).toBeTruthy();
  });

  test("selects a prompt from the entire participant bubble", () => {
    render(<TranscriptWorkspace {...props} />);

    const first = screen.getByRole("button", {
      name: /1\. Deltagare 12.*Jag testade pin 8/,
    });
    const second = screen.getByRole("button", {
      name: /3\. Deltagare 12.*Jag jämförde med kopplingsschemat/,
    });
    const gemini = screen.getByText("2. Gemini").closest("article");

    expect(first.getAttribute("aria-pressed")).toBe("true");
    expect(second.getAttribute("aria-pressed")).toBe("false");
    expect(within(first).getByText("Vald för kodning")).toBeTruthy();
    expect(screen.queryByText("Välj prompt")).toBeNull();
    expect(screen.queryByText("Vald prompt")).toBeNull();
    expect(gemini?.getAttribute("role")).toBeNull();

    fireEvent.click(
      within(second).getByText("Jag jämförde med kopplingsschemat."),
    );
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(within(second).getByText("Vald för kodning")).toBeTruthy();

    fireEvent.keyDown(first, { key: " " });
    expect(first.getAttribute("aria-pressed")).toBe("true");
    expect(second.getAttribute("aria-pressed")).toBe("false");
  });

  test("places overlapping sequences in separate lanes and opens their stored details", async () => {
    render(<TranscriptWorkspace {...props} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Visa AI-koder i transkriptet",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Visa Armin-koder i transkriptet",
      }),
    );

    const aiSequence = screen.getByRole("button", {
      name: /AI: S3, Direkt-svarssökande förlopp, meddelande 1–2/,
    });
    const arminSequence = screen.getByRole("button", {
      name: /Armin: S7, Produktiv samkonstruktion, meddelande 1–2/,
    });
    expect(aiSequence.style.gridColumn).toBe("1");
    expect(arminSequence.style.gridColumn).toBe("2");

    fireEvent.mouseEnter(aiSequence);
    expect(
      document.querySelectorAll('[data-sequence-highlighted="true"]'),
    ).toHaveLength(2);
    fireEvent.click(aiSequence);
    expect(
      (screen.getByLabelText("Visa AI-kodning") as HTMLInputElement).checked,
    ).toBe(true);
    const aiDetails = screen
      .getAllByText("Direkt-svarssökande förlopp")
      .map((element) => element.closest("details"))
      .find(Boolean);
    expect(aiDetails?.open).toBe(true);

    fireEvent.click(arminSequence);
    expect(screen.getByRole("button", { name: "Sekvenser" })).toBeTruthy();
    expect(await screen.findByText(/Armins sekvens/)).toBeTruthy();
  });

  test("positions a sequence tooltip beside the pointer", () => {
    render(<TranscriptWorkspace {...props} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Visa AI-koder i transkriptet",
      }),
    );
    const sequence = screen.getByRole("button", {
      name: /AI: S3, Direkt-svarssökande förlopp, meddelande 1–2/,
    });

    fireEvent.mouseMove(sequence, { clientX: 100, clientY: 150 });

    const tooltip = within(sequence).getByRole("tooltip");
    expect(tooltip.className).toContain("fixed");
    expect(tooltip.style.left).toBe("112px");
    expect(tooltip.style.top).toBe("162px");

    fireEvent.mouseLeave(sequence);
    expect(tooltip.className).toContain("absolute");
  });

  describe("saving researcher coding", () => {
    const armin = props.coding.R1[0] as ResearcherPromptCoding;

    function searchCode(text: string) {
      fireEvent.change(
        screen.getByPlaceholderText("Sök kod, beskrivning eller exempel"),
        { target: { value: text } },
      );
    }

    test("saves a prompt code as soon as it is chosen, without the unsaved note", async () => {
      vi.mocked(savePromptCodingAction).mockResolvedValue({
        ok: true,
        entry: { ...armin, codes: ["C2", "A6"] },
      });
      render(<TranscriptWorkspace {...props} />);

      fireEvent.change(screen.getByLabelText("Anteckning"), {
        target: { value: "En tanke som inte är klar" },
      });
      searchCode("noggrann");
      fireEvent.click(
        screen.getByRole("button", { name: /A6 · Precis rapportering/ }),
      );

      expect(savePromptCodingAction).toHaveBeenCalledWith({
        sessionId: "12_2",
        message: 1,
        codes: ["C2", "A6"],
      });
      expect(await screen.findByText("Sparat.")).toBeTruthy();
      expect(
        (screen.getByLabelText("Anteckning") as HTMLTextAreaElement).value,
      ).toBe("En tanke som inte är klar");
      expect(screen.getByText("Anteckningen är inte sparad.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Ta bort A6" })).toBeTruthy();
    });

    test("saves the note only with its button", async () => {
      vi.mocked(savePromptCodingAction).mockResolvedValue({
        ok: true,
        entry: { ...armin, note: "Ny anteckning" },
      });
      render(<TranscriptWorkspace {...props} />);
      const save = screen.getByRole("button", { name: "Spara anteckning" });
      expect((save as HTMLButtonElement).disabled).toBe(true);

      fireEvent.change(screen.getByLabelText("Anteckning"), {
        target: { value: "Ny anteckning" },
      });
      fireEvent.click(save);

      expect(savePromptCodingAction).toHaveBeenCalledWith({
        sessionId: "12_2",
        message: 1,
        note: "Ny anteckning",
      });
      await waitFor(() =>
        expect((save as HTMLButtonElement).disabled).toBe(true),
      );
      expect(screen.getByText("Sparat.")).toBeTruthy();
    });

    test("puts a removed code back when it could not be saved", async () => {
      vi.mocked(savePromptCodingAction).mockResolvedValue({
        ok: false,
        error: "Kodningen kunde inte sparas.",
      });
      render(<TranscriptWorkspace {...props} />);

      fireEvent.click(screen.getByRole("button", { name: "Ta bort C2" }));

      expect(savePromptCodingAction).toHaveBeenCalledWith({
        sessionId: "12_2",
        message: 1,
        codes: [],
      });
      expect(
        await screen.findByText("Kodningen kunde inte sparas."),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "Ta bort C2" })).toBeTruthy();
    });

    test("stores a new sequence with its first code and saves range changes at once", async () => {
      vi.mocked(saveSequenceCodingAction).mockImplementation(async (input) => ({
        ok: true,
        entry: {
          id: input.id,
          kind: "sequence",
          researcherId: "R1",
          firstMessage: input.firstMessage,
          lastMessage: input.lastMessage,
          note: "",
          codes: input.codes ?? ["S7"],
          frameworkVersion: "test",
          updatedAt: "2026-10-16T00:00:00.000Z",
        },
      }));
      render(<TranscriptWorkspace {...props} />);
      fireEvent.click(screen.getByRole("button", { name: "Sekvenser" }));
      fireEvent.click(screen.getByRole("button", { name: "Ny sekvens" }));

      // A draft's range is not saved on its own.
      fireEvent.change(screen.getByLabelText("Från meddelande"), {
        target: { value: "2" },
      });
      expect(saveSequenceCodingAction).not.toHaveBeenCalled();

      searchCode("samkonstruktion");
      fireEvent.click(
        screen.getByRole("button", { name: /S7 · Produktiv samkonstruktion/ }),
      );
      expect(saveSequenceCodingAction).toHaveBeenCalledWith({
        sessionId: "12_2",
        id: expect.stringMatching(/^sequence-/),
        firstMessage: 2,
        lastMessage: 3,
        codes: ["S7"],
      });
      expect(await screen.findByText("Redigera sekvens")).toBeTruthy();

      fireEvent.change(screen.getByLabelText("Till meddelande"), {
        target: { value: "2" },
      });
      expect(saveSequenceCodingAction).toHaveBeenLastCalledWith({
        sessionId: "12_2",
        id: expect.stringMatching(/^sequence-/),
        firstMessage: 2,
        lastMessage: 2,
      });
    });
  });
});
