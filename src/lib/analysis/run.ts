import type { Transcript } from "@/lib/scraping/transcript";

import {
  readAnalysisConfig,
  type Analyser,
  type AnalysisConfig,
} from "./analyser";
import { codingSchema, validateCoding } from "./coding";
import { AnalysisError } from "./errors";
import { createFakeAnalyser } from "./fake-analyser";
import {
  assertFrameworkAllowed,
  loadFramework,
  type Framework,
} from "./framework";
import {
  buildCodingInput,
  buildInstructions,
  buildReflectionInput,
  codingAsAnswer,
  MAX_TRANSCRIPT_CHARACTERS,
} from "./prompts";
import {
  generalReflection,
  reflectionCandidates,
  reflectionSchema,
  validateReflection,
} from "./reflection";
import type {
  AnalysisRun,
  StoredCoding,
  StoredReflectionQuestions,
  Usage,
} from "./types";

export type AnalysisJob = {
  transcript: Transcript;
  // Present when an earlier attempt got through step 1; a retry starts at step 2.
  coding: StoredCoding | null;
};

// Every write names the attempt it belongs to, and is refused once a newer attempt
// has started (DL-032).
export type AnalysisStore = {
  load(sessionId: string, attemptId: string): Promise<AnalysisJob | null>;
  saveCoding(
    sessionId: string,
    attemptId: string,
    coding: StoredCoding,
  ): Promise<boolean>;
  saveQuestions(
    sessionId: string,
    attemptId: string,
    questions: StoredReflectionQuestions,
  ): Promise<boolean>;
  fail(
    sessionId: string,
    attemptId: string,
    errorCode: string,
  ): Promise<boolean>;
};

export type RunDependencies = {
  store: AnalysisStore;
  loadFramework: () => Framework;
  readConfig: () => AnalysisConfig;
  createAnalyser: (config: AnalysisConfig) => Promise<Analyser>;
  now: () => Date;
  env: Readonly<Record<string, string | undefined>>;
  // Receives codes and message numbers only, never transcript content.
  log: (code: string, problems: string[], error?: unknown) => void;
};

type Step = {
  framework: Framework;
  analyser: Analyser;
  transcript: Transcript;
  instructions: string;
  codingInput: string;
  maxObservations: number;
  now: () => Date;
};

// Runs in the background after the student confirms (or retries), so it never
// throws: every failure ends in a stored error code the student can retry from.
export async function runAnalysis(
  sessionId: string,
  attemptId: string,
  deps: RunDependencies,
): Promise<void> {
  try {
    const framework = deps.loadFramework();
    assertFrameworkAllowed(framework, deps.env);
    const config = deps.readConfig();
    const analyser = await deps.createAnalyser(config);

    const job = await database(() => deps.store.load(sessionId, attemptId));
    if (!job) return;

    const codingInput = buildCodingInput(job.transcript);
    if (codingInput.length > MAX_TRANSCRIPT_CHARACTERS) {
      throw new AnalysisError("S2-TOO-LONG");
    }
    const step: Step = {
      framework,
      analyser,
      transcript: job.transcript,
      instructions: buildInstructions(framework),
      codingInput,
      maxObservations: config.maxObservations,
      now: deps.now,
    };

    const stored =
      job.coding?.frameworkVersion === framework.version ? job.coding : null;
    const coding =
      stored ?? (await retryOnceIfInvalid(deps, () => codeTranscript(step)));
    if (!stored) {
      const saved = await database(() =>
        deps.store.saveCoding(sessionId, attemptId, coding),
      );
      if (!saved) return;
    }

    const questions = await retryOnceIfInvalid(deps, () =>
      writeQuestions(step, coding),
    );
    await database(() =>
      deps.store.saveQuestions(sessionId, attemptId, questions),
    );
  } catch (error) {
    const failure =
      error instanceof AnalysisError
        ? error
        : new AnalysisError("S2-UNEXPECTED");
    deps.log(failure.code, failure.problems, error);
    try {
      await deps.store.fail(sessionId, attemptId, failure.code);
    } catch (storeError) {
      deps.log("S2-DB", ["could not record the failure"], storeError);
    }
  }
}

async function codeTranscript(step: Step): Promise<StoredCoding> {
  const { framework, analyser, transcript } = step;
  const schema = codingSchema(framework);
  const started = step.now();
  const { output, usage } = await analyser.code(
    {
      instructions: step.instructions,
      input: [{ role: "user", content: step.codingInput }],
      schema,
      schemaName: "coding",
      cacheKey: cacheKey("coding", framework),
    },
    { framework, transcript },
  );

  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    throw new AnalysisError("S2-INVALID-CODING", [
      "output did not match the schema",
    ]);
  }
  const valid = validateCoding(parsed.data, transcript);
  if (!valid.ok) throw new AnalysisError("S2-INVALID-CODING", valid.problems);
  return { ...stamp(step, started, usage), ...valid.value };
}

async function writeQuestions(
  step: Step,
  coding: StoredCoding,
): Promise<StoredReflectionQuestions> {
  const { framework, analyser, maxObservations } = step;
  const started = step.now();
  const candidates = reflectionCandidates(coding, framework);
  if (candidates.length === 0) {
    // Nothing to choose from, so the model is not asked.
    return {
      ...stamp(step, started, null),
      model: null,
      reasoningEffort: null,
      ...generalReflection(framework),
    };
  }

  const schema = reflectionSchema(maxObservations);
  const { output, usage } = await analyser.reflect(
    {
      instructions: step.instructions,
      // The coding conversation so far, so the model knows the whole chat.
      input: [
        { role: "user", content: step.codingInput },
        { role: "assistant", content: codingAsAnswer(coding) },
        {
          role: "user",
          content: buildReflectionInput(framework, candidates, maxObservations),
        },
      ],
      schema,
      schemaName: "reflection",
      cacheKey: cacheKey("reflection", framework),
    },
    { candidates, maxObservations },
  );

  const parsed = schema.safeParse(output);
  if (!parsed.success) {
    throw new AnalysisError("S2-INVALID-REFLECTION", [
      "output did not match the schema",
    ]);
  }
  const valid = validateReflection(
    parsed.data,
    candidates,
    framework,
    maxObservations,
  );
  if (!valid.ok) {
    throw new AnalysisError("S2-INVALID-REFLECTION", valid.problems);
  }
  return { ...stamp(step, started, usage), ...valid.value };
}

// OpenAI caches the output format together with the text after it, so each step
// has its own cache, shared by every student analysed with the same framework.
function cacheKey(step: string, framework: Framework): string {
  return `clarifai-${step}-${framework.version}`;
}

// Models occasionally quote loosely or skip a message; one fresh attempt usually
// fixes that. Anything else goes straight to the student's retry button.
async function retryOnceIfInvalid<T>(
  deps: RunDependencies,
  step: () => Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (error) {
    const invalid =
      error instanceof AnalysisError &&
      (error.code === "S2-INVALID-CODING" ||
        error.code === "S2-INVALID-REFLECTION");
    if (!invalid) throw error;
    deps.log(`${error.code} (retrying)`, error.problems);
    return step();
  }
}

async function database<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw error instanceof AnalysisError ? error : new AnalysisError("S2-DB");
  }
}

function stamp(step: Step, started: Date, usage: Usage | null): AnalysisRun {
  const finished = step.now();
  return {
    frameworkVersion: step.framework.version,
    frameworkStatus: step.framework.status,
    analyser: step.analyser.name,
    model: step.analyser.model,
    reasoningEffort: step.analyser.reasoningEffort,
    createdAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    usage,
  };
}

export function defaultRunDependencies(store: AnalysisStore): RunDependencies {
  return {
    store,
    loadFramework: () => loadFramework(),
    readConfig: () => readAnalysisConfig(),
    createAnalyser: async (config) => {
      if (config.analyser === "fake") return createFakeAnalyser();
      // Loaded only when needed, so the SDK stays out of the fake path.
      const { createOpenAiAnalyser } = await import("./openai-analyser");
      return createOpenAiAnalyser(config);
    },
    now: () => new Date(),
    env: process.env,
    log: (code, problems, error) => {
      console.error(
        code,
        error instanceof Error ? error.name : "",
        problems.join("; "),
      );
    },
  };
}
