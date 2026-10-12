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
                reflectionAssessment: {
                  state: "submitted",
                  agreements: ["yes", "partly"],
                },
              },
              2: {
                participantCode: "12",
                lesson: 2,
                state: "started",
                status: "processing",
                transcriptSubmission: "transcript",
                codedBy: [],
                reflectionAssessment: { state: "not_submitted" },
              },
              3: {
                participantCode: "12",
                lesson: 3,
                state: "completed",
                status: "completed",
                transcriptSubmission: "no_gemini",
                codedBy: [],
                reflectionAssessment: { state: "unavailable" },
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
                reflectionAssessment: { state: "unavailable" },
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

  test("shows dynamic student assessments and links only submitted reflections", () => {
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
                codedBy: [],
                reflectionAssessment: { state: "unavailable" },
              },
              2: {
                participantCode: "12",
                lesson: 2,
                state: "completed",
                status: "completed",
                transcriptSubmission: "transcript",
                codedBy: [],
                reflectionAssessment: {
                  state: "submitted",
                  agreements: ["yes", "partly", "no", null],
                },
              },
              3: {
                participantCode: "12",
                lesson: 3,
                state: "started",
                status: "awaiting_reflection",
                transcriptSubmission: "transcript",
                codedBy: [],
                reflectionAssessment: { state: "not_submitted" },
              },
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Studentbedömning" }));

    expect(screen.getByText("Ingen reflektion")).toBeTruthy();
    expect(screen.getAllByText("Ej inskickad")).toHaveLength(2);
    expect(screen.getByText("Reflektionsmoment 1: Ja")).toBeTruthy();
    expect(screen.getByText("Reflektionsmoment 2: Delvis")).toBeTruthy();
    expect(screen.getByText("Reflektionsmoment 3: Nej")).toBeTruthy();
    expect(screen.getByText("Reflektionsmoment 4: Ej besvarad")).toBeTruthy();

    const reflectionLink = screen.getByRole("link", {
      name: "Öppna reflektionen för deltagare 12, lektion 2",
    });
    expect(reflectionLink.getAttribute("href")).toBe(
      "/admin/participant/12/lesson/2?view=reflection",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
