import "server-only";

import OpenAI, {
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type {
  Analyser,
  ModelPrompt,
  ModelResult,
  ReasoningEffort,
} from "./analyser";
import { AnalysisError, type AnalysisErrorCode } from "./errors";
import type { Usage } from "./types";

// Reasoning tokens count towards this limit, so it is generous; only tokens used
// are billed.
const MAX_OUTPUT_TOKENS = 32_000;

export type ResponsesClient = { responses: Pick<OpenAI["responses"], "parse"> };

export function createOpenAiAnalyser(
  config: { apiKey: string; model: string; reasoningEffort: ReasoningEffort },
  client: ResponsesClient = new OpenAI({
    apiKey: config.apiKey,
    // Both steps must fit in the function's five minutes on Vercel; an
    // interrupted run is picked up by the retry button.
    timeout: 120_000,
    maxRetries: 1,
  }),
): Analyser {
  async function call<T>(
    prompt: ModelPrompt<T>,
    invalid: AnalysisErrorCode,
  ): Promise<ModelResult> {
    let response;
    try {
      response = await client.responses.parse({
        model: config.model,
        instructions: prompt.instructions,
        input: prompt.input,
        text: { format: zodTextFormat(prompt.schema, prompt.schemaName) },
        reasoning: { effort: config.reasoningEffort },
        // The transcript is already stored in Firestore; OpenAI only keeps its
        // standard abuse-monitoring logs.
        store: false,
        prompt_cache_key: prompt.cacheKey,
        max_output_tokens: MAX_OUTPUT_TOKENS,
      });
    } catch (error) {
      throw toAnalysisError(error, invalid);
    }

    if (response.status === "incomplete") {
      throw new AnalysisError("S2-INCOMPLETE", [
        `reason: ${response.incomplete_details?.reason ?? "unknown"}`,
      ]);
    }
    const refused = response.output.some(
      (item) =>
        item.type === "message" &&
        item.content.some((part) => part.type === "refusal"),
    );
    if (refused) throw new AnalysisError("S2-REFUSAL");
    if (response.output_parsed == null) {
      throw new AnalysisError(invalid, ["no structured output"]);
    }
    return { output: response.output_parsed, usage: toUsage(response.usage) };
  }

  return {
    name: "openai",
    model: config.model,
    reasoningEffort: config.reasoningEffort,
    code: (prompt) => call(prompt, "S2-INVALID-CODING"),
    reflect: (prompt) => call(prompt, "S2-INVALID-REFLECTION"),
  };
}

function toAnalysisError(
  error: unknown,
  invalid: AnalysisErrorCode,
): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof APIConnectionTimeoutError) {
    return new AnalysisError("S2-OPENAI-TIMEOUT");
  }
  if (error instanceof RateLimitError) {
    return new AnalysisError("S2-RATE-LIMIT");
  }
  if (error instanceof APIError) {
    return new AnalysisError("S2-OPENAI", [`status ${error.status ?? "none"}`]);
  }
  // The SDK parses the structured output itself and throws if it doesn't fit.
  if (error instanceof SyntaxError || (error as Error)?.name === "ZodError") {
    return new AnalysisError(invalid, ["output did not match the schema"]);
  }
  return new AnalysisError("S2-UNEXPECTED");
}

function toUsage(
  usage: OpenAI.Responses.ResponseUsage | undefined,
): Usage | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens,
    cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: usage.output_tokens,
    reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
  };
}
