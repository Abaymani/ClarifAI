import type { ZodType } from "zod";

import type { Transcript } from "@/lib/scraping/transcript";

import type { RawCoding } from "./coding";
import { AnalysisError } from "./errors";
import type { Framework } from "./framework";
import type { InputMessage } from "./prompts";
import type { Candidate, RawReflection } from "./reflection";
import type { Usage } from "./types";

export type ModelPrompt<T> = {
  instructions: string;
  input: InputMessage[];
  schema: ZodType<T>;
  schemaName: string;
  cacheKey: string;
};

// The output is checked against the prompt's schema by the caller, whichever
// analyser produced it.
export type ModelResult = { output: unknown; usage: Usage | null };

export interface Analyser {
  readonly name: "openai" | "fake";
  readonly model: string | null;
  readonly reasoningEffort: string | null;
  code(
    prompt: ModelPrompt<RawCoding>,
    context: { framework: Framework; transcript: Transcript },
  ): Promise<ModelResult>;
  reflect(
    prompt: ModelPrompt<RawReflection>,
    context: { candidates: Candidate[]; maxObservations: number },
  ): Promise<ModelResult>;
}

export const REASONING_EFFORTS = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type AnalysisConfig =
  | {
      analyser: "openai";
      apiKey: string;
      model: string;
      reasoningEffort: ReasoningEffort;
      maxObservations: number;
    }
  | { analyser: "fake"; maxObservations: number };

export const DEFAULT_MODEL = "gpt-6-sol";
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium";
export const DEFAULT_MAX_OBSERVATIONS = 3;

// The fake analyser lets the flow run without an API key: in end-to-end tests
// (CLARIFAI_FAKE_ANALYSIS=1) and in `pnpm dev` when no key is set. Production
// never uses it, whatever the flags say.
export function readAnalysisConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AnalysisConfig {
  const maxObservations = parseMaxObservations(env.REFLECTION_MAX_QUESTIONS);
  const production = env.VERCEL_ENV === "production";
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (!production && env.CLARIFAI_FAKE_ANALYSIS === "1") {
    return { analyser: "fake", maxObservations };
  }
  if (apiKey) {
    const effort = (env.OPENAI_REASONING_EFFORT?.trim() ||
      DEFAULT_REASONING_EFFORT) as ReasoningEffort;
    if (!REASONING_EFFORTS.includes(effort)) {
      throw new AnalysisError("S2-CONFIG", ["unknown OPENAI_REASONING_EFFORT"]);
    }
    return {
      analyser: "openai",
      apiKey,
      model: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      reasoningEffort: effort,
      maxObservations,
    };
  }
  if (!production && env.NODE_ENV === "development") {
    return { analyser: "fake", maxObservations };
  }
  throw new AnalysisError("S2-CONFIG", ["OPENAI_API_KEY is not set"]);
}

function parseMaxObservations(value: string | undefined): number {
  if (value === undefined || value.trim() === "")
    return DEFAULT_MAX_OBSERVATIONS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    throw new AnalysisError("S2-CONFIG", [
      "REFLECTION_MAX_QUESTIONS must be 1–10",
    ]);
  }
  return parsed;
}
