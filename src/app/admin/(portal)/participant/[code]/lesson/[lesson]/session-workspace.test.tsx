import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock(
  "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/transcript-workspace",
  () => ({ TranscriptWorkspace: () => <p>Transkriptinnehåll</p> }),
);
vi.mock(
  "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/reflection-overview",
  () => ({ ReflectionOverview: () => <p>Reflektionsinnehåll</p> }),
);

import { SessionWorkspace } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/session-workspace";

const props = {
  sessionId: "12_2",
  participantCode: "12",
  messages: [],
  analysis: null,
  coding: { R1: [], R2: [] },
  currentResearcher: "R1" as const,
  codeOptions: [],
  reflectionQuestions: {
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
        basedOn: null,
        excerpt: null,
        intro: "Reflektera.",
        questions: ["Vad hände?"],
        tip: null,
        template: { intro: "Reflektera.", questions: ["Vad hände?"] },
      },
    ],
  },
  reflectionResponses: null,
  reflectionComments: { R1: [], R2: [] },
  transcriptEmptyText: null,
};

describe("SessionWorkspace", () => {
  test("keeps the transcript as the default and opens all reflections in one tab", () => {
    render(<SessionWorkspace {...props} />);

    const transcriptTab = screen.getByRole("tab", {
      name: "Transkript och kodning",
    });
    const reflectionTab = screen.getByRole("tab", {
      name: "Reflektion · 1",
    });
    expect(transcriptTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Transkriptinnehåll")).toBeTruthy();

    fireEvent.click(reflectionTab);
    expect(reflectionTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Reflektionsinnehåll")).toBeTruthy();
  });

  test("keeps reflections available when the session has no transcript", () => {
    render(
      <SessionWorkspace
        {...props}
        transcriptEmptyText="Deltagaren använde inte Gemini."
      />,
    );

    expect(screen.getByText("Deltagaren använde inte Gemini.")).toBeTruthy();
    expect(screen.queryByText("Transkriptinnehåll")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Reflektion · 1" }));
    expect(screen.getByText("Reflektionsinnehåll")).toBeTruthy();
  });

  test("can open directly on the reflection tab", () => {
    render(<SessionWorkspace {...props} initialView="reflection" />);

    expect(
      screen
        .getByRole("tab", { name: "Reflektion · 1" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.getByText("Reflektionsinnehåll")).toBeTruthy();
    expect(
      screen
        .getByText("Transkriptinnehåll")
        .closest('[role="tabpanel"]')
        ?.hasAttribute("hidden"),
    ).toBe(true);
  });
});
