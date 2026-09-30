"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { defaultRunDependencies, runAnalysis } from "@/lib/analysis/run";
import {
  assertFrameworkAllowed,
  loadFramework,
} from "@/lib/analysis/framework";
import { noTranscriptReflection } from "@/lib/analysis/reflection";
import type { StoredReflectionQuestions } from "@/lib/analysis/types";
import {
  parseShareLink,
  shareLinkForStorage,
  type ShareLink,
} from "@/lib/scraping/gemini-link";
import { scrapeGeminiShare } from "@/lib/scraping/gemini-share";
import { redactText, redactTranscript } from "@/lib/scraping/redact-transcript";
import { ScrapeError, type ScrapeErrorCode } from "@/lib/scraping/scrape-error";
import { SESSION_COOKIE } from "@/lib/session/session-token";
import {
  analysisStore,
  beginTranscriptSubmission,
  completeReflection,
  confirmTranscript,
  declareNoGeminiUse,
  failTranscriptSubmission,
  getSessionByToken,
  rejectTranscript,
  retryAnalysis,
  saveTranscriptSubmission,
  TranscriptTooLargeError,
} from "@/lib/session/store";
import type {
  AnalysisAgreement,
  ReflectionResponse,
} from "@/lib/session/types";
import { MAX_REFLECTION_ANSWER_LENGTH } from "@/lib/session/types";
import { sv } from "@/lib/sv";

export type TranscriptFormState = {
  error: string | null;
  field: "link" | null;
};

export type ConfirmationState = { error: string | null };
export type NoGeminiState = { error: string | null };
export type ReflectionFormState = {
  error: string | null;
  fields: string[];
};

export async function submitTranscriptAction(
  _previous: TranscriptFormState,
  formData: FormData,
): Promise<TranscriptFormState> {
  void _previous;
  const link = String(formData.get("transcript-link") ?? "").trim();
  if (!link) {
    return { error: sv.errors.transcriptLinkMissing, field: "link" };
  }

  let parsedLink: ShareLink;
  try {
    parsedLink = parseShareLink(link);
  } catch {
    return {
      error: sv.errors.transcriptInvalidLink("S1-INVALID-LINK"),
      field: "link",
    };
  }

  const token = await requireSessionToken();
  const attemptId = randomUUID();
  let sessionId: string;
  try {
    const started = await beginTranscriptSubmission(
      token,
      attemptId,
      shareLinkForStorage(parsedLink),
    );
    if (!started.ok) return handleMutationProblem(started.reason);
    sessionId = started.session.id;
  } catch (error) {
    logSafeError("S1-BEGIN-DB", error);
    return { error: sv.errors.unexpected("S1-BEGIN-DB"), field: null };
  }

  try {
    const transcript = redactTranscript(await scrapeGeminiShare(link));
    const saved = await saveTranscriptSubmission(
      sessionId,
      token,
      attemptId,
      transcript,
    );
    if (!saved.ok) return handleMutationProblem(saved.reason);
  } catch (error) {
    const failure = failureFor(error);
    try {
      const failed = await failTranscriptSubmission(
        sessionId,
        token,
        attemptId,
        failure.code,
      );
      if (!failed.ok && failed.reason === "STALE") {
        return { error: sv.errors.transcriptSuperseded, field: null };
      }
    } catch (storeError) {
      logSafeError("S1-FAIL-DB", storeError);
    }
    logSafeError(failure.code, error);
    return { error: failure.message, field: failure.field };
  }

  revalidatePath("/session");
  return { error: null, field: null };
}

export async function confirmTranscriptAction(
  _previous: ConfirmationState,
): Promise<ConfirmationState> {
  void _previous;
  const token = await requireSessionToken();
  const analysisAttemptId = randomUUID();
  let completed = false;
  let analysedSessionId: string | null = null;
  try {
    const result = await confirmTranscript(token, analysisAttemptId);
    if (!result.ok) return { error: mutationProblemMessage(result.reason) };
    completed = result.session.status === "completed";
    if (result.session.status === "processing") {
      analysedSessionId = result.session.id;
    }
  } catch (error) {
    logSafeError("S1-CONFIRM-DB", error);
    return { error: sv.errors.unexpected("S1-CONFIRM-DB") };
  }

  if (completed) {
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/?submitted=1");
  }
  if (analysedSessionId) startAnalysis(analysedSessionId, analysisAttemptId);
  revalidatePath("/session");
  return { error: null };
}

export async function declareNoGeminiAction(
  _previous: NoGeminiState,
): Promise<NoGeminiState> {
  void _previous;
  const token = await requireSessionToken();
  let completed = false;
  try {
    const session = await getSessionByToken(token);
    if (!session) return { error: sv.errors.sessionExpired };

    let questions: StoredReflectionQuestions | null = null;
    if (session.lesson === 2 || session.lesson === 3) {
      const framework = loadFramework();
      assertFrameworkAllowed(framework);
      questions = {
        ...noTranscriptReflection(framework),
        frameworkVersion: framework.version,
        frameworkStatus: framework.status,
        analyser: "none",
        model: null,
        reasoningEffort: null,
        createdAt: new Date().toISOString(),
        durationMs: 0,
        usage: null,
      };
    }

    const result = await declareNoGeminiUse(token, questions);
    if (!result.ok) return { error: mutationProblemMessage(result.reason) };
    completed = result.session.status === "completed";
  } catch (error) {
    logSafeError("S3-NO-GEMINI", error);
    return { error: sv.errors.noGeminiFailed("S3-NO-GEMINI") };
  }

  if (completed) {
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/?submitted=no-gemini");
  }
  revalidatePath("/session");
  redirect("/session");
}

export async function submitReflectionAction(
  _previous: ReflectionFormState,
  formData: FormData,
): Promise<ReflectionFormState> {
  void _previous;
  const token = await requireSessionToken();
  let session;
  try {
    session = await getSessionByToken(token);
  } catch (error) {
    logSafeError("S3-LOAD-DB", error);
    return { error: sv.errors.unexpected("S3-LOAD-DB"), fields: [] };
  }
  if (!session) redirect("/");
  if (
    session.status !== "awaiting_reflection" ||
    !session.reflectionQuestions
  ) {
    return { error: sv.errors.reflectionNotReady, fields: [] };
  }

  const fields: string[] = [];
  const responses: ReflectionResponse[] = session.reflectionQuestions.items.map(
    (item) => {
      const answerField = `${item.id}:answer`;
      const agreementField = `${item.id}:agreement`;
      const answer = String(formData.get(answerField) ?? "").trim();
      if (!answer || answer.length > MAX_REFLECTION_ANSWER_LENGTH) {
        fields.push(answerField);
      }

      const rawAgreement = String(formData.get(agreementField) ?? "");
      const agreement: AnalysisAgreement | null = isAnalysisAgreement(
        rawAgreement,
      )
        ? rawAgreement
        : null;
      if (item.basedOn && agreement === null) fields.push(agreementField);

      return {
        itemId: item.id,
        answer: redactText(answer),
        agreement: item.basedOn ? agreement : null,
      };
    },
  );

  if (fields.length > 0) {
    return { error: sv.errors.reflectionIncomplete, fields };
  }

  try {
    const result = await completeReflection(token, responses);
    if (!result.ok) {
      return {
        error:
          result.reason === "INVALID_RESPONSE"
            ? sv.errors.reflectionIncomplete
            : mutationProblemMessage(result.reason),
        fields: [],
      };
    }
  } catch (error) {
    logSafeError("S3-SAVE-DB", error);
    return { error: sv.errors.unexpected("S3-SAVE-DB"), fields: [] };
  }

  (await cookies()).delete(SESSION_COOKIE);
  redirect("/?submitted=reflection");
}

export async function retryAnalysisAction(
  _previous: ConfirmationState,
): Promise<ConfirmationState> {
  void _previous;
  const token = await requireSessionToken();
  const attemptId = randomUUID();
  try {
    const result = await retryAnalysis(token, attemptId);
    if (!result.ok) {
      return {
        error:
          result.reason === "NOT_READY"
            ? sv.errors.analysisNotRetryable
            : mutationProblemMessage(result.reason),
      };
    }
    startAnalysis(result.session.id, attemptId);
  } catch (error) {
    logSafeError("S2-RETRY-DB", error);
    return { error: sv.errors.unexpected("S2-RETRY-DB") };
  }

  revalidatePath("/session");
  return { error: null };
}

// The student's request returns at once and the page polls for the result. The
// analysis keeps running after the response, within the page's maxDuration.
function startAnalysis(sessionId: string, attemptId: string): void {
  after(() =>
    runAnalysis(sessionId, attemptId, defaultRunDependencies(analysisStore)),
  );
}

export async function rejectTranscriptAction(
  _previous: ConfirmationState,
): Promise<ConfirmationState> {
  void _previous;
  const token = await requireSessionToken();
  try {
    const result = await rejectTranscript(token);
    if (!result.ok) return { error: mutationProblemMessage(result.reason) };
  } catch (error) {
    logSafeError("S1-REJECT-DB", error);
    return { error: sv.errors.unexpected("S1-REJECT-DB") };
  }

  revalidatePath("/session");
  return { error: null };
}

async function requireSessionToken(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/");
  return token;
}

function handleMutationProblem(
  reason: "UNAUTHENTICATED" | "ALREADY_COMPLETED" | "NOT_READY" | "STALE",
): TranscriptFormState {
  return { error: mutationProblemMessage(reason), field: null };
}

function mutationProblemMessage(
  reason: "UNAUTHENTICATED" | "ALREADY_COMPLETED" | "NOT_READY" | "STALE",
): string {
  if (reason === "STALE") return sv.errors.transcriptSuperseded;
  if (reason === "NOT_READY") return sv.errors.transcriptNotReady;
  return sv.errors.sessionExpired;
}

function isAnalysisAgreement(value: string): value is AnalysisAgreement {
  return value === "yes" || value === "partly" || value === "no";
}

function failureFor(error: unknown): {
  code: string;
  message: string;
  field: "link" | null;
} {
  if (error instanceof ScrapeError) {
    const code = `S1-${error.code}`;
    return {
      code,
      message: scrapeErrorMessage(error.code, code),
      field: error.code === "INVALID_LINK" ? "link" : null,
    };
  }
  if (error instanceof TranscriptTooLargeError) {
    return {
      code: "S1-TOO-LARGE",
      message: sv.errors.transcriptTooLarge("S1-TOO-LARGE"),
      field: null,
    };
  }
  return {
    code: "S1-DB",
    message: sv.errors.unexpected("S1-DB"),
    field: null,
  };
}

function scrapeErrorMessage(code: ScrapeErrorCode, diagnostic: string): string {
  switch (code) {
    case "INVALID_LINK":
      return sv.errors.transcriptInvalidLink(diagnostic);
    case "NOT_FOUND":
      return sv.errors.transcriptNotFound(diagnostic);
    case "NOT_ACCESSIBLE":
      return sv.errors.transcriptNotAccessible(diagnostic);
    case "EMPTY_TRANSCRIPT":
      return sv.errors.transcriptEmpty(diagnostic);
    case "TOO_LARGE":
      return sv.errors.transcriptTooLarge(diagnostic);
    case "FETCH_FAILED":
      return sv.errors.transcriptFetchFailed(diagnostic);
    case "UNEXPECTED_FORMAT":
      return sv.errors.transcriptUnexpectedFormat(diagnostic);
  }
}

function logSafeError(code: string, error: unknown): void {
  // Never log a submitted link or any transcript content.
  console.error(code, error instanceof Error ? error.name : "unknown");
}
