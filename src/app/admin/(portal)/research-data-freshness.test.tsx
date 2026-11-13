import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { refresh, refreshAction } = vi.hoisted(() => ({
  refresh: vi.fn(),
  refreshAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/admin/(portal)/research-data-actions", () => ({
  refreshResearchDataAction: refreshAction,
}));

import { ResearchDataFreshness } from "@/app/admin/(portal)/research-data-freshness";

describe("ResearchDataFreshness", () => {
  beforeEach(() => {
    refresh.mockReset();
    refreshAction.mockReset();
  });

  test("says when the data was fetched", () => {
    render(<ResearchDataFreshness fetchedAt="10:42" />);
    expect(screen.getByText(/Hämtad 10:42/)).toBeTruthy();
  });

  test("fetches fresh data and reloads the page", async () => {
    refreshAction.mockResolvedValue({ ok: true });
    render(<ResearchDataFreshness fetchedAt="10:42" />);

    fireEvent.click(screen.getByRole("button", { name: "Uppdatera" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(refreshAction).toHaveBeenCalledTimes(1);
  });

  test("shows why it could not refresh", async () => {
    refreshAction.mockResolvedValue({
      ok: false,
      error: "Du är inte längre inloggad.",
    });
    render(<ResearchDataFreshness fetchedAt="10:42" />);

    fireEvent.click(screen.getByRole("button", { name: "Uppdatera" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
