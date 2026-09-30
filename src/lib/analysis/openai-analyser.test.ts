import { APIConnectionTimeoutError, APIError, RateLimitError } from "openai";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ModelPrompt } from "./analyser";
import { createOpenAiAnalyser, type ResponsesClient } from "./openai-analyser";

const prompt: ModelPrompt<unknown> = {
  instructions: "framework",
  input: [{ role: "user", content: "transcript" }],
  schema: z.object({ ok: z.boolean() }) as never,
  schemaName: "coding",
  cacheKey: "clarifai-analysis-TEST",
};

function analyserReturning(response: unknown) {
  const parse = vi.fn().mockResolvedValue(response);
  const client = { responses: { parse } } as unknown as ResponsesClient;
  const analyser = createOpenAiAnalyser(
    { apiKey: "sk-test", model: "gpt-6-sol", reasoningEffort: "medium" },
    client,
  );
  return { analyser, parse };
}

function analyserThrowing(error: unknown) {
  const parse = vi.fn().mockRejectedValue(error);
  const client = { responses: { parse } } as unknown as ResponsesClient;
  return createOpenAiAnalyser(
    { apiKey: "sk-test", model: "gpt-6-sol", reasoningEffort: "medium" },
    client,
  );
}

const completed = {
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
  output_parsed: { ok: true },
  usage: {
    input_tokens: 12_000,
    input_tokens_details: { cached_tokens: 10_000 },
    output_tokens: 900,
    output_tokens_details: { reasoning_tokens: 400 },
  },
};

describe("createOpenAiAnalyser", () => {
  it("asks for strict JSON, keeps nothing at OpenAI and uses the shared cache key", async () => {
    const { analyser, parse } = analyserReturning(completed);
    await analyser.code(prompt as never, {} as never);

    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: "gpt-6-sol",
      instructions: "framework",
      input: [{ role: "user", content: "transcript" }],
      reasoning: { effort: "medium" },
      store: false,
      prompt_cache_key: "clarifai-analysis-TEST",
      text: { format: { type: "json_schema", name: "coding", strict: true } },
    });
  });

  it("returns the parsed output and token usage", async () => {
    const { analyser } = analyserReturning(completed);
    expect(await analyser.reflect(prompt as never, {} as never)).toEqual({
      output: { ok: true },
      usage: {
        inputTokens: 12_000,
        cachedInputTokens: 10_000,
        outputTokens: 900,
        reasoningTokens: 400,
      },
    });
  });

  it("reports a cut-off answer and a refusal with their own codes", async () => {
    const cutOff = analyserReturning({
      ...completed,
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    }).analyser;
    await expect(
      cutOff.code(prompt as never, {} as never),
    ).rejects.toMatchObject({
      code: "S2-INCOMPLETE",
      problems: ["reason: max_output_tokens"],
    });

    const refusing = analyserReturning({
      ...completed,
      output: [
        { type: "message", content: [{ type: "refusal", refusal: "No." }] },
      ],
      output_parsed: null,
    }).analyser;
    await expect(
      refusing.code(prompt as never, {} as never),
    ).rejects.toMatchObject({
      code: "S2-REFUSAL",
    });
  });

  it("treats a missing structured output as an invalid result of that step", async () => {
    const { analyser } = analyserReturning({
      ...completed,
      output_parsed: null,
    });
    await expect(
      analyser.reflect(prompt as never, {} as never),
    ).rejects.toMatchObject({
      code: "S2-INVALID-REFLECTION",
    });
  });

  it("maps API failures to error codes", async () => {
    const cases: [unknown, string][] = [
      [new APIConnectionTimeoutError(), "S2-OPENAI-TIMEOUT"],
      [
        new RateLimitError(429, undefined, "slow down", new Headers()),
        "S2-RATE-LIMIT",
      ],
      [new APIError(500, undefined, "boom", new Headers()), "S2-OPENAI"],
      [new SyntaxError("Unexpected token"), "S2-INVALID-CODING"],
      [new Error("anything else"), "S2-UNEXPECTED"],
    ];
    for (const [error, code] of cases) {
      await expect(
        analyserThrowing(error).code(prompt as never, {} as never),
      ).rejects.toMatchObject({ code });
    }
  });
});
