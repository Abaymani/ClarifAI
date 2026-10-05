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
              },
              2: {
                participantCode: "12",
                lesson: 2,
                state: "started",
                status: "processing",
                transcriptSubmission: "transcript",
              },
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("Slutförd")).toBeTruthy();
    expect(screen.getByText("Påbörjad")).toBeTruthy();
    expect(screen.getAllByText("Saknas")).toHaveLength(2);
    expect(screen.getAllByRole("link")).toHaveLength(4);
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
});
