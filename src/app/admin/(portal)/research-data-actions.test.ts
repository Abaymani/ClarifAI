import { beforeEach, describe, expect, test, vi } from "vitest";

const { updateTag, getCurrentResearcher } = vi.hoisted(() => ({
  updateTag: vi.fn(),
  getCurrentResearcher: vi.fn(),
}));

vi.mock("next/cache", () => ({ updateTag }));
vi.mock("@/lib/admin/auth", () => ({ getCurrentResearcher }));
vi.mock("@/lib/admin/cached-research-data", () => ({
  RESEARCH_DATA_TAG: "research-data",
}));

import { refreshResearchDataAction } from "@/app/admin/(portal)/research-data-actions";

describe("refreshResearchDataAction", () => {
  beforeEach(() => {
    updateTag.mockReset();
  });

  test("expires the portal's cached data for a signed-in researcher", async () => {
    getCurrentResearcher.mockResolvedValue({ id: "R1" });

    expect(await refreshResearchDataAction()).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledWith("research-data");
  });

  test("does nothing for anyone else", async () => {
    getCurrentResearcher.mockResolvedValue(null);

    expect(await refreshResearchDataAction()).toEqual({
      ok: false,
      error: "Du är inte längre inloggad.",
    });
    expect(updateTag).not.toHaveBeenCalled();
  });
});
