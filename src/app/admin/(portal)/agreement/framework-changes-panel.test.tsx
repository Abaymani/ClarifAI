import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { tryChanges } = vi.hoisted(() => ({ tryChanges: vi.fn() }));

vi.mock("@/app/admin/(portal)/agreement-actions", () => ({
  tryFrameworkChangesAction: tryChanges,
}));

import { FrameworkChangesPanel } from "@/app/admin/(portal)/agreement/framework-changes-panel";
import type { ChangeVariant, PairChange } from "@/lib/admin/coder-agreement";

const codes = [
  { code: "P1", name: "Beslutsdelegation", level: "P" as const },
  { code: "A2", name: "Beslutsdelegation", level: "A" as const },
  { code: "C3", name: "Förklaring och verifikation", level: "C" as const },
  { code: "C10", name: "Strategisk hjälpsökning", level: "C" as const },
];

function pairChange(pair: PairChange["pair"], transcripts: number): PairChange {
  return {
    pair,
    transcripts,
    prompts: 48,
    affected: 12,
    codes: {
      before: 0.6,
      after: 0.7,
      difference: { estimate: 0.1, interval: [0.05, 0.15] },
    },
    levels: {
      before: 0.8,
      after: 0.8,
      difference: { estimate: 0, interval: [-0.02, 0.01] },
    },
  };
}

const variants: ChangeVariant[] = [
  {
    lesson: null,
    base: "pair",
    pairs: [
      pairChange("R1-R2", 12),
      pairChange("AI-R1", 12),
      pairChange("AI-R2", 8),
    ],
  },
];

function renderPanel() {
  return render(
    <FrameworkChangesPanel codes={codes} lesson={null} base="pair" />,
  );
}

function check(code: string) {
  fireEvent.click(
    screen.getByRole("checkbox", { name: new RegExp(`^${code} `) }),
  );
}

function addMergeOfP1AndA2OnLevelP() {
  check("P1");
  check("A2");
  fireEvent.change(screen.getByLabelText("Nivå för den sammanslagna koden"), {
    target: { value: "P" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Lägg till sammanslagning" }),
  );
}

describe("FrameworkChangesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("asks for a level when the merged codes span levels", () => {
    renderPanel();

    check("P1");
    check("A2");
    const add = screen.getByRole("button", {
      name: "Lägg till sammanslagning",
    });
    expect(add.hasAttribute("disabled")).toBe(true);
    expect(
      within(screen.getByLabelText("Nivå för den sammanslagna koden"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Välj nivå", "Passiv", "Aktiv"]);

    fireEvent.change(screen.getByLabelText("Nivå för den sammanslagna koden"), {
      target: { value: "P" },
    });
    fireEvent.click(add);

    expect(
      within(screen.getByRole("list", { name: "Ändringar" })).getByText(
        "Slå ihop P1 + A2 → nivå P",
      ),
    ).toBeTruthy();
    // A code can only be part of one change.
    expect(
      screen.getByRole("checkbox", { name: /^P1 / }).hasAttribute("disabled"),
    ).toBe(true);
    expect(
      within(screen.getByLabelText("Ta bort kod"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["", "C3", "C10"]);
  });

  test("merges codes on one level without asking, and adds deletions", () => {
    renderPanel();

    check("C3");
    check("C10");
    expect(
      screen.queryByLabelText("Nivå för den sammanslagna koden"),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Lägg till sammanslagning" }),
    );
    fireEvent.change(screen.getByLabelText("Ta bort kod"), {
      target: { value: "P1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lägg till borttagning" }),
    );

    expect(
      within(screen.getByRole("list", { name: "Ändringar" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Slå ihop C3 + C10", "Ta bort P1"]);
  });

  test("tries the changes and shows each pair before and after", async () => {
    tryChanges.mockResolvedValue({ ok: true, variants });
    renderPanel();
    addMergeOfP1AndA2OnLevelP();

    fireEvent.click(
      screen.getByRole("button", { name: "Räkna med ändringarna" }),
    );

    await waitFor(() =>
      expect(tryChanges).toHaveBeenCalledWith([
        { kind: "merge", codes: ["P1", "A2"], level: "P" },
      ]),
    );
    const table = within(
      await screen.findByRole("table", {
        name: "Överensstämmelse före och efter ändringarna",
      }),
    );
    const aiFrida = within(
      table.getByRole("rowheader", { name: "AI – Frida" }).closest("tr")!,
    );
    expect(aiFrida.getByText("0,60 → 0,70")).toBeTruthy();
    expect(aiFrida.getByText("+0,10 (95 % KI 0,05–0,15)")).toBeTruthy();
    expect(aiFrida.getByText("0,00 (95 % KI −0,02 till 0,01)")).toBeTruthy();
    expect(aiFrida.getAllByText("Osäkert")).toHaveLength(2);
    expect(aiFrida.getByText("12 av 48")).toBeTruthy();
  });

  test("forgets a result once the changes change", async () => {
    tryChanges.mockResolvedValue({ ok: true, variants });
    renderPanel();
    addMergeOfP1AndA2OnLevelP();
    fireEvent.click(
      screen.getByRole("button", { name: "Räkna med ändringarna" }),
    );
    await screen.findByRole("table");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ta bort ändringen: Slå ihop P1 + A2 → nivå P",
      }),
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("Inga ändringar än.")).toBeTruthy();
  });

  test("shows why the changes could not be tried", async () => {
    tryChanges.mockResolvedValue({
      ok: false,
      error: "P1 ingår i mer än en ändring.",
    });
    renderPanel();
    addMergeOfP1AndA2OnLevelP();

    fireEvent.click(
      screen.getByRole("button", { name: "Räkna med ändringarna" }),
    );

    expect(
      await screen.findByText("P1 ingår i mer än en ändring."),
    ).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
