import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { OverviewTable } from "@/app/admin/(portal)/overview/overview-table";

describe("OverviewTable", () => {
  test("shows the three session states and links every lesson cell", () => {
    render(
      <OverviewTable
        participants={[
          {
            participantCode: "12",
            sessions: {
              1: {
                participantCode: "12",
                lesson: 1,
                state: "completed",
                status: "completed",
                transcriptSubmission: "transcript",
                codedBy: ["R1", "R2"],
              },
              2: {
                participantCode: "12",
                lesson: 2,
                state: "started",
                status: "processing",
                transcriptSubmission: "transcript",
                codedBy: [],
              },
              3: {
                participantCode: "12",
                lesson: 3,
                state: "completed",
                status: "completed",
                transcriptSubmission: "no_gemini",
                codedBy: [],
              },
            },
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Slutförd")).toHaveLength(2);
    expect(screen.getByText("Påbörjad")).toBeTruthy();
    expect(screen.getByText("Saknas")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(4);

    fireEvent.click(screen.getByRole("tab", { name: "Forskarkodning" }));
    expect(screen.getAllByText("Armin")).toHaveLength(2);
    expect(screen.getAllByText("Frida")).toHaveLength(2);
    expect(screen.getAllByText("Kodad")).toHaveLength(2);
    expect(screen.getAllByText("Ej kodad")).toHaveLength(2);
    expect(screen.getAllByText("Inget transkript")).toHaveLength(2);
    expect(
      screen
        .getByRole("tab", { name: "Forskarkodning" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  test("filters by participant code", () => {
    render(
      <OverviewTable
        participants={[
          { participantCode: "12", sessions: {} },
          { participantCode: "34", sessions: {} },
        ]}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Sök deltagarkod"), {
      target: { value: "34" },
    });
    expect(screen.queryByText("Deltagare 12")).toBeNull();
    expect(screen.getByText("Deltagare 34")).toBeTruthy();
  });

  test("optionally hides only participants without any session", () => {
    render(
      <OverviewTable
        participants={[
          { participantCode: "12", sessions: {} },
          {
            participantCode: "34",
            sessions: {
              2: {
                participantCode: "34",
                lesson: 2,
                state: "started",
                status: "awaiting_transcript",
                transcriptSubmission: null,
                codedBy: [],
              },
            },
          },
        ]}
      />,
    );

    const filter = screen.getByRole("checkbox", {
      name: /Dölj deltagare utan aktivitet/,
    });
    expect((filter as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Deltagare 12")).toBeTruthy();
    expect(screen.getByText("Deltagare 34")).toBeTruthy();

    fireEvent.click(filter);
    expect(screen.queryByText("Deltagare 12")).toBeNull();
    expect(screen.getByText("Deltagare 34")).toBeTruthy();
  });
});
