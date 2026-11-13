import { beforeEach, describe, expect, it, vi } from "vitest";

const { unstableCache, store } = vi.hoisted(() => ({
  unstableCache: vi.fn(),
  store: {
    listAdminOverview: vi.fn(),
    loadStudentDevelopment: vi.fn(),
    loadAgreementInputs: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ unstable_cache: unstableCache }));
vi.mock("@/lib/admin/store", () => store);

// Passes calls straight through, recording how each function is cached.
unstableCache.mockImplementation(
  (load: () => Promise<unknown>) => () => load(),
);

const {
  RESEARCH_DATA_SECONDS,
  RESEARCH_DATA_TAG,
  cachedResearchData,
  deploymentKey,
  formatFetchedAt,
} = await import("@/lib/admin/cached-research-data");
// Recorded at import, before the test runner clears mocks between tests.
const cacheCalls = [...unstableCache.mock.calls];

describe("cached research data", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("caches the three full reads for ten minutes under one tag", () => {
    const configs = cacheCalls.map(([, keyParts, options]) => ({
      name: keyParts[1],
      options,
    }));

    expect(RESEARCH_DATA_SECONDS).toBe(600);
    expect(configs).toEqual(
      ["admin-overview", "student-development", "agreement-inputs"].map(
        (name) => ({
          name,
          options: { tags: [RESEARCH_DATA_TAG], revalidate: 600 },
        }),
      ),
    );
  });

  it("names the deployment in every key", () => {
    expect(cacheCalls).toHaveLength(3);
    for (const [, keyParts] of cacheCalls) {
      expect(keyParts).toEqual(["research-data", keyParts[1], deploymentKey()]);
    }
    expect(deploymentKey({ VERCEL_DEPLOYMENT_ID: "dpl_1" })).toBe("dpl_1");
    expect(deploymentKey({ VERCEL_GIT_COMMIT_SHA: "abc123" })).toBe("abc123");
    expect(deploymentKey({})).toBe("local");
  });

  it("returns the data with the time it was read", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T09:42:00Z"));

    const result = await cachedResearchData("test", async () => [1, 2])();

    expect(result).toEqual({
      data: [1, 2],
      fetchedAt: "2026-11-13T09:42:00.000Z",
    });
    expect(formatFetchedAt(result.fetchedAt)).toBe("10:42");
  });
});
