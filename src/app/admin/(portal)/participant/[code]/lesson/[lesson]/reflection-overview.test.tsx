import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/admin/(portal)/reflection-actions", () => ({
  saveReflectionCommentAction: vi.fn(),
}));

import { saveReflectionCommentAction } from "@/app/admin/(portal)/reflection-actions";
import { ReflectionOverview } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/reflection-overview";

const questions = {
  frameworkVersion: "test",
  frameworkStatus: "ACTIVE",
  analyser: "fake" as const,
  model: null,
  reasoningEffort: null,
  createdAt: "2026-10-09T00:00:00.000Z",
  durationMs: 1,
  usage: null,
  outcome: "observations" as const,
  items: [
    {
      id: "q1",
      group: "F11",
      groupKind: "reinforce" as const,
      basedOn: {
        kind: "prompt" as const,
        code: "A6",
        firstMessage: 1,
        lastMessage: 1,
      },
      excerpt: { message: 1, text: "Jag testade pin 8." },
      intro: "Du beskrev kopplingen noggrant.",
      questions: ["Vad gjorde beskrivningen tydlig?"],
      tip: null,
      template: {
        intro: "Du beskrev [kopplingen] noggrant.",
        questions: ["Vad gjorde [beskrivningen] tydlig?"],
      },
    },
    {
      id: "q2",
      group: "R4",
      groupKind: "reflect" as const,
      basedOn: {
        kind: "prompt" as const,
        code: "C2",
        firstMessage: 3,
        lastMessage: 3,
      },
      excerpt: { message: 3, text: "Jag har en egen idé." },
      intro: "Du prövade en egen idé.",
      questions: ["Hur kom du fram till idén?"],
      tip: null,
      template: {
        intro: "Du prövade [en egen idé].",
        questions: ["Hur kom du fram till [idén]?"],
      },
    },
  ],
};

const props = {
  sessionId: "12_2",
  questions,
  responses: {
    submittedAt: new Date("2026-10-09T09:00:00.000Z"),
    items: [
      {
        itemId: "q1",
        answer: "Jag skrev vilka pinnar jag använde.",
        agreement: "partly" as const,
      },
      {
        itemId: "q2",
        answer: "Jag jämförde två lösningar.",
        agreement: "yes" as const,
      },
    ],
  },
  messages: [
    {
      index: 1,
      role: "student" as const,
      text: "Jag testade pin 8. Sensorn visar fortfarande noll centimeter.",
    },
    { index: 2, role: "gemini" as const, text: "Kontrollera echo." },
    { index: 3, role: "student" as const, text: "Jag har en egen idé." },
  ],
  coding: {
    R1: [
      {
        id: "prompt-1",
        kind: "prompt" as const,
        researcherId: "R1" as const,
        message: 1,
        note: "",
        codes: ["C2"],
        frameworkVersion: "test",
        updatedAt: "2026-10-09T00:00:00.000Z",
      },
    ],
    R2: [
      {
        id: "prompt-1",
        kind: "prompt" as const,
        researcherId: "R2" as const,
        message: 1,
        note: "",
        codes: ["A6"],
        frameworkVersion: "test",
        updatedAt: "2026-10-09T00:00:00.000Z",
      },
    ],
  },
  comments: {
    R1: [
      {
        itemId: "q1",
        researcherId: "R1" as const,
        comment: "Armins kommentar",
        updatedAt: "2026-10-09T00:00:00.000Z",
      },
    ],
    R2: [
      {
        itemId: "q1",
        researcherId: "R2" as const,
        comment: "Fridas kommentar",
        updatedAt: "2026-10-09T00:00:00.000Z",
      },
    ],
  },
  currentResearcher: "R1" as const,
};

describe("ReflectionOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  test("shows every reflection moment with agreement and source-labelled coding", () => {
    render(<ReflectionOverview {...props} />);

    expect(screen.getByText("Reflektionsmoment 1")).toBeTruthy();
    expect(screen.getByText("Reflektionsmoment 2")).toBeTruthy();
    expect(screen.getByText("Delvis")).toBeTruthy();
    expect(screen.getByText("Ja")).toBeTruthy();
    expect(screen.getByText("AI · A6")).toBeTruthy();
    expect(screen.getByText("Armin · C2")).toBeTruthy();
    expect(screen.getByText("Frida · A6")).toBeTruthy();
  });

  test("toggles from the stored excerpt to the full student message", () => {
    render(<ReflectionOverview {...props} />);

    const summary = screen
      .getAllByText("Visa hela meddelandet")[0]
      .closest("summary");
    const details = summary?.closest("details");
    expect(details?.open).toBe(false);
    fireEvent.click(summary!);
    expect(details?.open).toBe(true);
    expect(
      screen.getByText(
        "Jag testade pin 8. Sensorn visar fortfarande noll centimeter.",
      ),
    ).toBeTruthy();
  });

  test("shows both researchers' comments but only edits the signed-in researcher's comment", async () => {
    vi.mocked(saveReflectionCommentAction).mockResolvedValue({
      ok: true,
      entry: {
        itemId: "q1",
        researcherId: "R1",
        comment: "Uppdaterad av Armin",
        updatedAt: "2026-10-09T10:00:00.000Z",
      },
    });
    render(<ReflectionOverview {...props} />);

    expect(screen.getAllByText("Armins kommentar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fridas kommentar").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Din kommentar · Frida")).toBeNull();

    const ownFields = screen.getAllByLabelText("Din kommentar · Armin");
    fireEvent.change(ownFields[0], {
      target: { value: "Uppdaterad av Armin" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Spara min kommentar" })[0],
    );

    await waitFor(() =>
      expect(saveReflectionCommentAction).toHaveBeenCalledWith({
        sessionId: "12_2",
        itemId: "q1",
        comment: "Uppdaterad av Armin",
      }),
    );
    expect(screen.getAllByText("Uppdaterad av Armin").length).toBeGreaterThan(
      0,
    );
  });
});
