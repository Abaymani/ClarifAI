import { describe, expect, it } from "vitest";

import { readAnalysisConfig } from "./analyser";

describe("readAnalysisConfig", () => {
  it("uses OpenAI with the default model when a key is set", () => {
    expect(readAnalysisConfig({ OPENAI_API_KEY: "sk-test" })).toEqual({
      analyser: "openai",
      apiKey: "sk-test",
      model: "gpt-6-sol",
      reasoningEffort: "medium",
      maxObservations: 3,
    });
  });

  it("takes the model, reasoning effort and question count from the environment", () => {
    expect(
      readAnalysisConfig({
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-6-astra",
        OPENAI_REASONING_EFFORT: "high",
        REFLECTION_MAX_QUESTIONS: "2",
      }),
    ).toMatchObject({
      model: "gpt-6-astra",
      reasoningEffort: "high",
      maxObservations: 2,
    });
  });

  it("falls back to the fake analyser only in development or when asked to", () => {
    expect(readAnalysisConfig({ NODE_ENV: "development" }).analyser).toBe(
      "fake",
    );
    expect(
      readAnalysisConfig({
        CLARIFAI_FAKE_ANALYSIS: "1",
        OPENAI_API_KEY: "sk-test",
      }).analyser,
    ).toBe("fake");
  });

  it("never fakes the analysis in production", () => {
    expect(() =>
      readAnalysisConfig({
        VERCEL_ENV: "production",
        NODE_ENV: "development",
        CLARIFAI_FAKE_ANALYSIS: "1",
      }),
    ).toThrow(expect.objectContaining({ code: "S2-CONFIG" }));
    expect(
      readAnalysisConfig({
        VERCEL_ENV: "production",
        CLARIFAI_FAKE_ANALYSIS: "1",
        OPENAI_API_KEY: "sk-test",
      }).analyser,
    ).toBe("openai");
  });

  it("refuses to run a deployed build without a key", () => {
    expect(() => readAnalysisConfig({ NODE_ENV: "production" })).toThrow(
      expect.objectContaining({ code: "S2-CONFIG" }),
    );
  });

  it("rejects settings it does not understand", () => {
    for (const env of [
      { OPENAI_API_KEY: "sk-test", OPENAI_REASONING_EFFORT: "extreme" },
      { OPENAI_API_KEY: "sk-test", REFLECTION_MAX_QUESTIONS: "0" },
      { OPENAI_API_KEY: "sk-test", REFLECTION_MAX_QUESTIONS: "three" },
    ]) {
      expect(() => readAnalysisConfig(env)).toThrow(
        expect.objectContaining({ code: "S2-CONFIG" }),
      );
    }
  });
});
