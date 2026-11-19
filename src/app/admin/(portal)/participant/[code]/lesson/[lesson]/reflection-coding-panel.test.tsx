import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/admin/(portal)/reflection-actions", () => ({
  saveReflectionCodingAction: vi.fn(),
}));

import { saveReflectionCodingAction } from "@/app/admin/(portal)/reflection-actions";
import { ReflectionCodingPanel } from "@/app/admin/(portal)/participant/[code]/lesson/[lesson]/reflection-coding-panel";

const framework = {
  version: "test",
  states: [
    {
      state: 1,
      criteria: [
        { id: "S1-A", label: "1 for why things went well" },
        { id: "S1-B", label: "1 for why things did not go well" },
      ],
    },
    { state: 2, criteria: [{ id: "S2-A", label: "1 for another situation" }] },
  ],
};

const props = {
  sessionId: "12_2",
  itemId: "q1",
  framework,
  currentResearcher: "R2" as const,
  submitted: true,
  coding: {
    R1: {
      itemId: "q1",
      researcherId: "R1" as const,
      criteria: ["S1-A", "S2-A"],
      coded: true,
      frameworkVersion: "test",
      updatedAt: "2026-11-19T00:00:00.000Z",
    },
    R2: null,
  },
};

describe("ReflectionCodingPanel", () => {
  beforeEach(() => {
    vi.mocked(saveReflectionCodingAction).mockReset();
    vi.mocked(saveReflectionCodingAction).mockResolvedValue({
      ok: true,
      entry: null,
    });
  });

  test("saves the whole record on every tick and on the coded mark", async () => {
    render(<ReflectionCodingPanel {...props} />);

    expect(screen.getByText("Frida · ej kodad")).toBeTruthy();
    expect(screen.getByText("2/3 · kodad")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("1 for why things went well"));
    fireEvent.click(screen.getByLabelText("1 for another situation"));
    expect(screen.getByText(/^Summa/).textContent).toBe("Summa 2/3");
    fireEvent.click(screen.getByRole("button", { name: "Markera som kodad" }));

    await waitFor(() =>
      expect(saveReflectionCodingAction).toHaveBeenCalledTimes(3),
    );
    expect(saveReflectionCodingAction).toHaveBeenNthCalledWith(1, {
      sessionId: "12_2",
      itemId: "q1",
      criteria: ["S1-A"],
      coded: false,
    });
    expect(saveReflectionCodingAction).toHaveBeenLastCalledWith({
      sessionId: "12_2",
      itemId: "q1",
      criteria: ["S1-A", "S2-A"],
      coded: true,
    });
    expect(screen.getByText("Frida · kodad")).toBeTruthy();
    expect(await screen.findByText("Sparat.")).toBeTruthy();
  });

  test("cannot code a reflection that was not submitted", () => {
    render(<ReflectionCodingPanel {...props} submitted={false} />);

    expect(
      screen.getByLabelText("1 for why things went well").matches(":disabled"),
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Markera som kodad",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        "Reflektionen har inte skickats in, så momentet kan inte kodas.",
      ),
    ).toBeTruthy();
  });

  test("shows a failed save", async () => {
    vi.mocked(saveReflectionCodingAction).mockResolvedValue({
      ok: false,
      error: "Reflektionskodningen kunde inte sparas.",
    });
    render(<ReflectionCodingPanel {...props} />);

    fireEvent.click(screen.getByLabelText("1 for why things went well"));

    expect(
      await screen.findByText("Reflektionskodningen kunde inte sparas."),
    ).toBeTruthy();
  });
});
