import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { OverviewTable } from "@/app/admin/(portal)/overview/overview-table";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  test("marks in the status badge whether a lesson has a transcript or the student did not use Gemini", () => {
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
                transcriptSubmission: "no_gemini",
                codedBy: [],
                reflectionAssessment: { state: "unavailable" },
              },
              3: {
                participantCode: "12",
                lesson: 3,
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

    const cell = (lesson: number) => {
      const link = screen
        .getAllByRole("link")
        .find((candidate) =>
          candidate.getAttribute("href")?.endsWith(`/${lesson}`),
        );
      if (!link) throw new Error(`no cell for lesson ${lesson}`);
      return link;
    };
    // The symbol sits inside the same badge as the status, without a visible label.
    const transcript = within(cell(1)).getByTitle("Transkript");
    expect(transcript.parentElement?.textContent).toBe("SlutfördTranskript");
    expect(transcript.querySelector("svg")).toBeTruthy();
    const noGemini = within(cell(2)).getByTitle("Använde inte Gemini");
    expect(noGemini.parentElement?.textContent).toBe(
      "SlutfördAnvände inte Gemini",
    );
    expect(cell(3).textContent).toBe("Påbörjad");
    expect(cell(4).textContent).toBe("Saknas");

    fireEvent.click(screen.getByRole("tab", { name: "Forskarkodning" }));
    expect(screen.queryByTitle("Transkript")).toBeNull();
    expect(screen.queryByTitle("Använde inte Gemini")).toBeNull();
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

  test("totals the student assessments of the participants shown", () => {
    const submitted = (
      participantCode: string,
      lesson: 1 | 2 | 3 | 4,
      agreements: ("yes" | "partly" | "no" | null)[],
    ) => ({
      participantCode,
      lesson,
      state: "completed" as const,
      status: "completed" as const,
      transcriptSubmission: "transcript" as const,
      codedBy: [],
      reflectionAssessment: { state: "submitted" as const, agreements },
    });
    render(
      <OverviewTable
        participants={[
          {
            participantCode: "12",
            sessions: {
              1: submitted("12", 1, ["yes", "partly"]),
              3: submitted("12", 3, ["yes", "no", null]),
            },
          },
          {
            participantCode: "34",
            sessions: { 2: submitted("34", 2, ["no", "no", "yes"]) },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Studentbedömning" }));

    const totals = () =>
      Object.fromEntries(
        [...screen.getByLabelText("Totalt").querySelectorAll("div")].map(
          (entry) => [
            entry.querySelector("dt")?.textContent,
            entry.querySelector("dd")?.textContent,
          ],
        ),
      );
    expect(totals()).toEqual({
      Ja: "3",
      Delvis: "1",
      Nej: "3",
      "Ej besvarad": "1",
    });

    fireEvent.change(screen.getByPlaceholderText("Sök deltagarkod"), {
      target: { value: "34" },
    });
    expect(totals()).toEqual({
      Ja: "1",
      Delvis: "0",
      Nej: "2",
      "Ej besvarad": "0",
    });
  });

  test("counts the AI's codes per ICAP level for every lesson", () => {
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
                reflectionAssessment: { state: "unavailable" },
                aiCodeCounts: { P: 5, A: 0, C: 2 },
              },
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "AI-kodning" }));

    const lesson2 = screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href")?.endsWith("/2"));
    // One short label per level, from P on the left to C on the right.
    const labels = [...lesson2!.querySelectorAll("[title]")].map((label) => [
      label.getAttribute("title"),
      label.querySelector('[aria-hidden="true"]')?.textContent,
    ]);
    expect(labels).toEqual([
      ["Passiv", "5 P"],
      ["Aktiv", "0 A"],
      ["Konstruktiv", "2 C"],
    ]);
    expect(within(lesson2!).getByText("Passiv: 5")).toBeTruthy();
    expect(screen.getAllByText("Ingen AI-kodning")).toHaveLength(3);
    expect(
      screen
        .getByRole("tabpanel", { name: "AI-kodning" })
        .querySelectorAll("a"),
    ).toHaveLength(4);
  });

  test("lists each reflection moment's words, the session total and the average for lessons 2 and 3", () => {
    const base = {
      state: "completed" as const,
      status: "completed" as const,
      transcriptSubmission: "transcript" as const,
      codedBy: [],
      reflectionAssessment: { state: "unavailable" as const },
    };
    render(
      <OverviewTable
        participants={[
          {
            participantCode: "12",
            sessions: {
              1: { ...base, participantCode: "12", lesson: 1 },
              2: {
                ...base,
                participantCode: "12",
                lesson: 2,
                reflectionWords: { state: "submitted", moments: [42, 0, 1200] },
              },
              3: {
                ...base,
                participantCode: "12",
                lesson: 3,
                reflectionWords: { state: "not_submitted", moments: 2 },
              },
            },
          },
          {
            participantCode: "13",
            sessions: {
              2: {
                ...base,
                participantCode: "13",
                lesson: 2,
                reflectionWords: { state: "unavailable" },
              },
            },
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Reflektionslängd" }));

    expect(
      screen.queryByRole("tab", { name: "Reflektionskodning" }),
    ).toBeNull();
    expect(
      screen.getByRole("columnheader", { name: "Lektion 2" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("columnheader", { name: "Lektion 3" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("columnheader", { name: "Lektion 1" }),
    ).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Lektion 4" }),
    ).toBeNull();
    const cell = screen.getByRole("link", {
      name: "Öppna reflektionen för deltagare 12, lektion 2",
    });
    expect(cell.getAttribute("href")).toBe(
      "/admin/participant/12/lesson/2?view=reflection",
    );
    // The default text matcher turns the thousands separator into a plain space.
    for (const words of ["42 ord", "0 ord", "1 200 ord", "1 242 ord"]) {
      expect(within(cell).getByText(words)).toBeTruthy();
    }
    expect(within(cell).getByText("Reflektionsmoment 3")).toBeTruthy();
    expect(within(cell).getByText("Totalt")).toBeTruthy();
    expect(within(cell).getByText("Medel")).toBeTruthy();
    expect(within(cell).getByText("414,0 ord")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ladda ner Excel" }),
    ).toBeTruthy();
    expect(screen.getByText("Ej inskickad")).toBeTruthy();
    expect(screen.getAllByText("Ingen reflektion")).toHaveLength(2);

    fireEvent.click(screen.getByLabelText(/Dölj deltagare utan reflektion/));
    expect(screen.getByText("Deltagare 12")).toBeTruthy();
    expect(screen.queryByText("Deltagare 13")).toBeNull();
  });
  test("copies a LaTeX table of mean reflection lengths for every participant", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const base = {
      state: "completed" as const,
      status: "completed" as const,
      transcriptSubmission: "transcript" as const,
      codedBy: [],
      reflectionAssessment: { state: "unavailable" as const },
    };
    render(
      <OverviewTable
        participants={[
          {
            participantCode: "12",
            sessions: {
              2: {
                ...base,
                participantCode: "12",
                lesson: 2,
                reflectionWords: { state: "submitted", moments: [42, 0, 1200] },
              },
            },
          },
          {
            participantCode: "13",
            sessions: {
              2: {
                ...base,
                participantCode: "13",
                lesson: 2,
                reflectionWords: { state: "submitted", moments: [8] },
              },
            },
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Reflektionslängd" }));
    // The table ignores the search, like the Excel file.
    fireEvent.change(screen.getByPlaceholderText("Sök deltagarkod"), {
      target: { value: "12" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Kopiera medelvärden (LaTeX)" }),
    );

    await waitFor(() => expect(screen.getByText("Kopierat")).toBeTruthy());
    // Totals 1242 and 8 words; 414 and 8 words per moment.
    expect(writeText.mock.calls[0][0]).toContain(
      String.raw`    Lesson 2 & 2 & 625.0 (872.6) & 211.0 (287.1) \\`,
    );
  });
});
