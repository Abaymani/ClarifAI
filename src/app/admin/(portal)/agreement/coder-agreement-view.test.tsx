import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { refresh, runAgreement } = vi.hoisted(() => ({
  refresh: vi.fn(),
  runAgreement: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("@/app/admin/(portal)/agreement-actions", () => ({
  runCoderAgreementAction: runAgreement,
}));

import { CoderAgreementView } from "@/app/admin/(portal)/agreement/coder-agreement-view";
import {
  calculateCoderAgreement,
  type AgreementSessionInput,
  type StoredCoderAgreement,
} from "@/lib/admin/coder-agreement";
import type { Lesson } from "@/lib/session/credentials";

const codes = [
  { code: "P1", name: "Beslutsdelegation", level: "P" as const },
  { code: "A2", name: "Motiveringskrävande", level: "A" as const },
  { code: "C3", name: "Förklaring och verifikation", level: "C" as const },
];

function session(
  id: string,
  coding: Partial<Record<"R1" | "R2" | "AI", Record<number, string[]>>>,
): AgreementSessionInput {
  const [participantCode, lesson] = id.split("_");
  const entries = (byPrompt: Record<number, string[]> = {}) =>
    Object.entries(byPrompt).map(([message, codes]) => ({
      message: Number(message),
      codes,
    }));
  return {
    sessionId: id,
    participantCode,
    lesson: Number(lesson) as Lesson,
    prompts: [1, 3, 5, 7],
    coding: {
      R1: entries(coding.R1),
      R2: entries(coding.R2),
      AI: entries(coding.AI),
    },
  };
}

const agreement: StoredCoderAgreement = {
  ...calculateCoderAgreement(
    [
      session("701_2", {
        R1: { 1: ["P1"], 3: ["A2", "P1"] },
        R2: { 1: ["P1"], 3: ["P1"] },
        AI: { 1: ["P1"], 3: ["C3"] },
      }),
      session("702_3", { R1: { 1: ["C3"] }, AI: { 1: ["C3"] } }),
      session("650_1", { AI: { 1: ["P1"] } }),
    ],
    { promptCodes: codes },
  ),
  calculatedAt: "2026-11-09T12:32:00.000Z",
  calculatedBy: "R2",
};

// Twelve transcripts all three coded: enough for intervals without the mark.
const larger: StoredCoderAgreement = {
  ...calculateCoderAgreement(
    Array.from({ length: 12 }, (_, s) =>
      session(`${710 + s}_2`, {
        R1: { 1: ["P1"], 3: s % 3 === 0 ? ["A2"] : ["C3"] },
        R2: { 1: ["P1"], 3: s % 4 === 0 ? ["A2"] : ["C3"] },
        AI: { 1: s % 5 === 0 ? ["C3"] : ["P1"], 3: ["C3"] },
      }),
    ),
    { promptCodes: codes },
  ),
  calculatedAt: "2026-11-09T12:32:00.000Z",
  calculatedBy: "R1",
};

function renderView(stored: StoredCoderAgreement | null = agreement) {
  return render(
    <CoderAgreementView
      agreement={stored}
      calculatedAt={stored ? "9 november 2026 13:32" : null}
      codes={codes}
      // Lesson 1 of participant 702 was handed in under code 650 (DL-072).
      studyCodes={{ "701_2": "701", "702_3": "702", "650_1": "702" }}
    />,
  );
}

function card(section: string, pair: string) {
  return within(
    within(screen.getByRole("region", { name: section })).getByRole("region", {
      name: pair,
    }),
  );
}

function transcriptLinks() {
  return within(screen.getByRole("region", { name: "Transkript" }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

describe("CoderAgreementView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("offers the first run before anything has been calculated", () => {
    renderView(null);

    expect(
      screen.getByRole("heading", { name: "Inte beräknad än" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Beräkna" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Promptkoder" })).toBeNull();
  });

  test("runs the calculation and shows the new result", async () => {
    runAgreement.mockResolvedValue({ ok: true });
    renderView(null);

    fireEvent.click(screen.getByRole("button", { name: "Beräkna" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(runAgreement).toHaveBeenCalledTimes(1);
  });

  test("keeps the previous result and says so when a run fails", async () => {
    runAgreement.mockResolvedValue({
      ok: false,
      error: "Beräkningen misslyckades. Det förra resultatet ligger kvar.",
    });
    renderView();

    fireEvent.click(screen.getByRole("button", { name: "Beräkna igen" }));

    expect(
      await screen.findByText(
        "Beräkningen misslyckades. Det förra resultatet ligger kvar.",
      ),
    ).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Promptkoder" })).toBeTruthy();
  });

  test("says when and by whom the result was calculated, and what it covers", () => {
    renderView();

    expect(
      screen.getByRole("heading", {
        name: "Beräknad 9 november 2026 13:32 av Frida",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Kodade transkript: Armin 2 · Frida 1 · AI 3\./),
    ).toBeTruthy();
  });

  test("shows each pair per code and lists the transcripts under the portal's codes", () => {
    renderView();

    expect(
      card("Promptkoder", "AI – Armin").getByText("2 transkript · 8 prompter"),
    ).toBeTruthy();

    const table = within(
      screen.getByRole("table", { name: "Överensstämmelse per kod" }),
    );
    const row = (code: RegExp) =>
      within(table.getByRole("rowheader", { name: code }).closest("tr")!);
    expect(row(/A2/).getByText("Motiveringskrävande")).toBeTruthy();
    expect(
      row(/A2/).getByText("båda 0 · bara Armin 1 · bara Frida 0"),
    ).toBeTruthy();
    // Neither researcher gave C3 in the one transcript they both coded.
    expect(row(/C3/).getAllByText("används inte")).toHaveLength(1);

    expect(transcriptLinks()).toEqual([
      "/admin/participant/701/lesson/2",
      "/admin/participant/702/lesson/1",
      "/admin/participant/702/lesson/3",
    ]);
    expect(
      screen
        .getAllByRole("link", { name: "Deltagare 702" })
        .map((link) => link.getAttribute("title")),
    ).toEqual(["Inlämnad med kod 650", null]);
  });

  test("switches between lessons and between the transcripts compared", () => {
    renderView();

    fireEvent.change(screen.getByLabelText("Lektion"), {
      target: { value: "3" },
    });
    const aiArmin = card("Promptkoder", "AI – Armin");
    expect(aiArmin.getByText("1,00")).toBeTruthy();
    expect(
      aiArmin.getByText("Samma koder på 100 % av prompterna"),
    ).toBeTruthy();
    expect(
      card("Promptkoder", "Armin – Frida").getByText(
        "Inga transkript som båda har kodat.",
      ),
    ).toBeTruthy();
    expect(transcriptLinks()).toEqual(["/admin/participant/702/lesson/3"]);

    fireEvent.change(screen.getByLabelText("Lektion"), {
      target: { value: "all" },
    });
    fireEvent.change(screen.getByLabelText("Transkript som jämförs"), {
      target: { value: "allThree" },
    });
    expect(
      card("Promptkoder", "AI – Armin").getByText("1 transkript · 4 prompter"),
    ).toBeTruthy();
    expect(transcriptLinks()).toEqual(["/admin/participant/701/lesson/2"]);
  });

  test("shows each card's interval, marked when it rests on fewer than 10 transcripts", () => {
    renderView();

    const aiArmin = card("Promptkoder", "AI – Armin");
    expect(aiArmin.getByText(/^95 % KI \d,\d\d/)).toBeTruthy();
    expect(aiArmin.getByText("Osäkert: färre än 10 transkript")).toBeTruthy();
    // One transcript cannot be redrawn into anything else.
    expect(
      card("Promptkoder", "Armin – Frida").getByText(
        "95 % KI kan inte beräknas",
      ),
    ).toBeTruthy();
  });

  test("leaves the mark out from 10 transcripts and compares the AI with Armin–Frida on all three", () => {
    renderView(larger);

    expect(screen.queryByText(/Osäkert/)).toBeNull();
    expect(
      within(
        screen.getByRole("table", { name: "Överensstämmelse per ICAP-nivå" }),
      ).getAllByText(/^KI /).length,
    ).toBeGreaterThan(0);
    expect(
      within(
        screen.getByRole("table", { name: "Överensstämmelse per kod" }),
      ).queryAllByText(/^KI /),
    ).toHaveLength(0);
    expect(
      card("Promptkoder", "AI – Armin").queryByText(/^Jämfört med/),
    ).toBeNull();

    fireEvent.change(screen.getByLabelText("Transkript som jämförs"), {
      target: { value: "allThree" },
    });
    expect(
      card("Promptkoder", "AI – Armin").getByText(
        /^Jämfört med Armin – Frida: [−+]?\d,\d\d \(95 % KI /,
      ),
    ).toBeTruthy();
    expect(
      card("ICAP-nivåer", "AI – Frida").getByText(/^Jämfört med Armin – Frida/),
    ).toBeTruthy();
    expect(
      card("Promptkoder", "Armin – Frida").queryByText(/^Jämfört med/),
    ).toBeNull();
  });

  test("asks for a new run when the stored result has no intervals", () => {
    // As stored before intervals were calculated (DL-077).
    const old = JSON.parse(
      JSON.stringify(agreement, (key, value) =>
        ["bootstrap", "interval", "versusResearchers"].includes(key)
          ? undefined
          : value,
      ),
    ) as StoredCoderAgreement;
    renderView(old);

    expect(
      screen.getByText(/saknar intervall; beräkna igen för att få dem\./),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Promptkoder" })).queryByText(
        /KI/,
      ),
    ).toBeNull();
  });
});
