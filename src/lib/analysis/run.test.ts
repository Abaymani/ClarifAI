import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { Analyser } from "./analyser";
import { AnalysisError } from "./errors";
import { createFakeAnalyser } from "./fake-analyser";
import {
  runAnalysis,
  type AnalysisJob,
  type AnalysisStore,
  type RunDependencies,
} from "./run";
import { sampleTranscript, testFramework } from "./test-fixtures";
import type { StoredCoding, StoredReflectionQuestions } from "./types";

function memoryStore(
  job: AnalysisJob | null = { transcript: sampleTranscript(), coding: null },
) {
  const saved: {
    coding: StoredCoding | null;
    questions: StoredReflectionQuestions | null;
    failure: string | null;
  } = { coding: null, questions: null, failure: null };
  const store = {
    load: vi.fn(async () => job),
    saveCoding: vi.fn(async (_s: string, _a: string, coding: StoredCoding) => {
      saved.coding = coding;
      return true;
    }),
    saveQuestions: vi.fn(
      async (_s: string, _a: string, questions: StoredReflectionQuestions) => {
        saved.questions = questions;
        return true;
      },
    ),
    fail: vi.fn(async (_s: string, _a: string, code: string) => {
      saved.failure = code;
      return true;
    }),
  } satisfies AnalysisStore;
  return { store, saved };
}

function spyAnalyser(base: Analyser = createFakeAnalyser()) {
  return { ...base, code: vi.fn(base.code), reflect: vi.fn(base.reflect) };
}

function dependencies(
  store: AnalysisStore,
  analyser: Analyser,
  overrides: Partial<RunDependencies> = {},
): RunDependencies {
  let tick = 0;
  return {
    store,
    loadFramework: () => testFramework(),
    readConfig: () => ({ analyser: "fake", maxObservations: 3 }),
    createAnalyser: async () => analyser,
    // Each reading is a second later, so durations are measurable.
    now: () => new Date(Date.UTC(2026, 8, 29, 10, 0, tick++)),
    env: {},
    log: vi.fn(),
    ...overrides,
  };
}

describe("runAnalysis", () => {
  it("codes, stores the coding, then stores the questions", async () => {
    const { store, saved } = memoryStore();
    await runAnalysis("s1", "a1", dependencies(store, createFakeAnalyser()));

    expect(saved.failure).toBeNull();
    expect(saved.coding).toMatchObject({
      frameworkVersion: "TEST-fixture",
      frameworkStatus: "TEST",
      analyser: "fake",
      durationMs: 1000,
      prompts: [{ message: 1 }, { message: 3 }, { message: 5 }, { message: 7 }],
    });
    expect(saved.questions).toMatchObject({ outcome: "observations" });
    expect(saved.questions?.items).toHaveLength(3);
    expect(store.saveCoding.mock.invocationCallOrder[0]).toBeLessThan(
      store.saveQuestions.mock.invocationCallOrder[0],
    );
  });

  // OpenAI caches the output format together with the text that follows it, so
  // both must be the same for every student for the framework to be cached.
  it("opens each step the same way for every student, so OpenAI can cache it", async () => {
    const prompts = async (transcript = sampleTranscript()) => {
      const { store } = memoryStore({ transcript, coding: null });
      const analyser = spyAnalyser();
      await runAnalysis("s1", "a1", dependencies(store, analyser));
      return [
        analyser.code.mock.calls[0][0],
        analyser.reflect.mock.calls[0][0],
      ];
    };
    const other = sampleTranscript();
    other.messages[2].text = "Varför piper buzzern hela tiden?";
    const [codingA, reflectionA] = await prompts();
    const [codingB, reflectionB] = await prompts(other);

    for (const [a, b] of [
      [codingA, codingB],
      [reflectionA, reflectionB],
    ] as const) {
      expect(b.instructions).toBe(a.instructions);
      expect(b.cacheKey).toBe(a.cacheKey);
      expect(z.toJSONSchema(b.schema)).toEqual(z.toJSONSchema(a.schema));
    }
    expect(reflectionA.instructions).toBe(codingA.instructions);
    expect(reflectionA.cacheKey).not.toBe(codingA.cacheKey);
    // Step 2 sees the coding conversation before its own task.
    expect(reflectionA.input.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(reflectionA.input[0]).toEqual(codingA.input[0]);
  });

  it("reuses stored coding on a retry and only redoes step 2", async () => {
    const first = memoryStore();
    await runAnalysis(
      "s1",
      "a1",
      dependencies(first.store, createFakeAnalyser()),
    );

    const { store, saved } = memoryStore({
      transcript: sampleTranscript(),
      coding: first.saved.coding,
    });
    const analyser = spyAnalyser();
    await runAnalysis("s1", "a2", dependencies(store, analyser));

    expect(analyser.code).not.toHaveBeenCalled();
    expect(store.saveCoding).not.toHaveBeenCalled();
    expect(saved.questions?.items).toHaveLength(3);
  });

  it("codes again if the stored coding came from another framework version", async () => {
    const first = memoryStore();
    await runAnalysis(
      "s1",
      "a1",
      dependencies(first.store, createFakeAnalyser()),
    );
    const outdated = { ...first.saved.coding!, frameworkVersion: "TEST-older" };

    const { store } = memoryStore({
      transcript: sampleTranscript(),
      coding: outdated,
    });
    const analyser = spyAnalyser();
    await runAnalysis("s1", "a2", dependencies(store, analyser));
    expect(analyser.code).toHaveBeenCalledOnce();
  });

  it("gives an invalid coding one more try, then records the failure", async () => {
    const analyser = spyAnalyser();
    analyser.code.mockResolvedValue({
      output: { prompts: [], sequences: [] },
      usage: null,
    });
    const { store, saved } = memoryStore();
    const deps = dependencies(store, analyser);
    await runAnalysis("s1", "a1", deps);

    expect(analyser.code).toHaveBeenCalledTimes(2);
    expect(saved.failure).toBe("S2-INVALID-CODING");
    expect(store.saveCoding).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(
      "S2-INVALID-CODING",
      expect.arrayContaining(["prompt 1: not coded"]),
      expect.any(AnalysisError),
    );
  });

  it("recovers when the second try is valid", async () => {
    const analyser = spyAnalyser();
    analyser.code.mockResolvedValueOnce({
      output: { nonsense: true },
      usage: null,
    });
    const { store, saved } = memoryStore();
    await runAnalysis("s1", "a1", dependencies(store, analyser));

    expect(analyser.code).toHaveBeenCalledTimes(2);
    expect(saved.failure).toBeNull();
    expect(saved.questions).not.toBeNull();
  });

  it("does nothing for an attempt that is no longer current", async () => {
    const { store } = memoryStore(null);
    const analyser = spyAnalyser();
    await runAnalysis("s1", "old", dependencies(store, analyser));

    expect(analyser.code).not.toHaveBeenCalled();
    expect(store.fail).not.toHaveBeenCalled();
  });

  it("stops after step 1 if a newer attempt took over meanwhile", async () => {
    const { store } = memoryStore();
    store.saveCoding.mockResolvedValue(false);
    const analyser = spyAnalyser();
    await runAnalysis("s1", "old", dependencies(store, analyser));

    expect(analyser.reflect).not.toHaveBeenCalled();
    expect(store.fail).not.toHaveBeenCalled();
  });

  it("uses the general question without asking the model when nothing qualifies", async () => {
    const analyser = spyAnalyser();
    const transcript = sampleTranscript();
    analyser.code.mockResolvedValue({
      output: {
        prompts: transcript.messages
          .filter((message) => message.role === "student")
          .map((message) => ({
            message: message.index,
            codes: [],
            note: "För lite sammanhang.",
          })),
        sequences: [],
      },
      usage: null,
    });
    const { store, saved } = memoryStore({ transcript, coding: null });
    await runAnalysis("s1", "a1", dependencies(store, analyser));

    expect(analyser.reflect).not.toHaveBeenCalled();
    expect(saved.questions).toMatchObject({
      outcome: "insufficient_evidence",
      model: null,
      items: [{ group: "R0", groupKind: "general" }],
    });
  });

  it("uses the general questions when the model finds nothing suitable", async () => {
    const analyser = spyAnalyser();
    analyser.reflect.mockResolvedValue({
      output: { observations: [] },
      usage: null,
    });
    const { store, saved } = memoryStore();
    await runAnalysis("s1", "a1", dependencies(store, analyser));

    expect(saved.failure).toBeNull();
    expect(saved.questions).toMatchObject({
      outcome: "insufficient_evidence",
      items: [{ group: "R0", questions: ["General question (R0)?"] }],
    });
  });

  it("refuses to produce research data with the TEST framework in production", async () => {
    const { store, saved } = memoryStore();
    const analyser = spyAnalyser();
    await runAnalysis(
      "s1",
      "a1",
      dependencies(store, analyser, { env: { VERCEL_ENV: "production" } }),
    );

    expect(saved.failure).toBe("S2-TEST-FRAMEWORK");
    expect(analyser.code).not.toHaveBeenCalled();
  });

  it("records configuration, length, OpenAI and database problems", async () => {
    const cases: [
      Partial<RunDependencies>,
      (a: ReturnType<typeof spyAnalyser>, s: AnalysisStore) => void,
      string,
    ][] = [
      [
        {
          readConfig: () => {
            throw new AnalysisError("S2-CONFIG");
          },
        },
        () => {},
        "S2-CONFIG",
      ],
      [
        {},
        (analyser) =>
          analyser.code.mockRejectedValue(new AnalysisError("S2-RATE-LIMIT")),
        "S2-RATE-LIMIT",
      ],
      [
        {},
        (_analyser, store) =>
          vi.mocked(store.load).mockRejectedValue(new Error("unavailable")),
        "S2-DB",
      ],
      [
        {},
        (analyser) => analyser.code.mockRejectedValue(new TypeError("bug")),
        "S2-UNEXPECTED",
      ],
    ];
    for (const [overrides, arrange, code] of cases) {
      const { store, saved } = memoryStore();
      const analyser = spyAnalyser();
      arrange(analyser, store);
      await runAnalysis("s1", "a1", dependencies(store, analyser, overrides));
      expect(saved.failure).toBe(code);
    }
  });

  it("refuses transcripts too long to analyse", async () => {
    const transcript = sampleTranscript();
    transcript.messages[1].text = "x".repeat(400_000);
    const { store, saved } = memoryStore({ transcript, coding: null });
    await runAnalysis("s1", "a1", dependencies(store, spyAnalyser()));
    expect(saved.failure).toBe("S2-TOO-LONG");
  });

  it("never throws, even when recording the failure fails", async () => {
    const { store } = memoryStore();
    store.fail.mockRejectedValue(new Error("unavailable"));
    const analyser = spyAnalyser();
    analyser.code.mockRejectedValue(new AnalysisError("S2-OPENAI"));
    const deps = dependencies(store, analyser);

    await expect(runAnalysis("s1", "a1", deps)).resolves.toBeUndefined();
    expect(deps.log).toHaveBeenCalledWith(
      "S2-DB",
      ["could not record the failure"],
      expect.any(Error),
    );
  });
});
