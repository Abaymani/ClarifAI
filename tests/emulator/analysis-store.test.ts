import { describe, expect, test } from "vitest";

import { loadFramework } from "@/lib/analysis/framework";
import { defaultRunDependencies, runAnalysis } from "@/lib/analysis/run";
import { sampleTranscript } from "@/lib/analysis/test-fixtures";
import type {
  StoredCoding,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import { getDb } from "@/lib/firebase/admin";
import {
  createSessionToken,
  hashSessionToken,
} from "@/lib/session/session-token";
import {
  analysisStore,
  beginTranscriptSubmission,
  confirmTranscript,
  getSessionByToken,
  retryAnalysis,
  saveTranscriptSubmission,
  startSession,
} from "@/lib/session/store";

const MINUTE = 60_000;

// Each test uses its own code, because the emulator keeps data for the whole run.
async function confirmedSession(
  code: string,
  lesson: 1 | 2 | 3 | 4,
  options: { attemptId?: string; confirmedAt?: Date } = {},
) {
  await getDb()
    .collection("participants")
    .doc(code)
    .set({ code, pin: "4321", failedAttempts: 0, lockedUntil: null });
  const token = createSessionToken();
  const started = await startSession(
    { code, pin: "4321", lesson },
    hashSessionToken(token),
  );
  if (!started.ok) throw new Error(`Could not start: ${started.reason}`);
  const sessionId = started.session.id;
  await beginTranscriptSubmission(token, "scrape-a", "link");
  await saveTranscriptSubmission(
    sessionId,
    token,
    "scrape-a",
    sampleTranscript(),
  );
  const confirmed = await confirmTranscript(
    token,
    options.attemptId ?? "analysis-a",
    options.confirmedAt,
  );
  if (!confirmed.ok) throw new Error(`Could not confirm: ${confirmed.reason}`);
  return { token, sessionId };
}

function coding(): StoredCoding {
  return {
    frameworkVersion: "TEST-fixture",
    frameworkStatus: "TEST",
    analyser: "fake",
    model: null,
    reasoningEffort: null,
    createdAt: "2026-09-29T10:00:00.000Z",
    durationMs: 10,
    usage: null,
    prompts: [
      { message: 1, code: "C5", excerpt: "Jag tror", justification: "x" },
    ],
    sequences: [],
  };
}

function questions(): StoredReflectionQuestions {
  return {
    ...coding(),
    outcome: "insufficient_evidence",
    items: [
      {
        id: "q1",
        group: "R0",
        groupKind: "general",
        basedOn: null,
        excerpt: null,
        explanation: null,
        template: "[TEST] Fråga",
        question: "[TEST] Fråga",
      },
    ],
  };
}

describe("analysis in the session store", () => {
  test("confirming lesson 2 starts an analysis attempt", async () => {
    const { token, sessionId } = await confirmedSession("820", 2);

    expect(await getSessionByToken(token)).toMatchObject({
      status: "processing",
      analysisStartedAt: expect.any(Date),
    });
    expect(await analysisStore.load(sessionId, "analysis-a")).toMatchObject({
      transcript: { messages: expect.any(Array) },
      coding: null,
    });
    expect(await analysisStore.load(sessionId, "someone-else")).toBeNull();
  });

  test("confirming lesson 1 starts no analysis", async () => {
    const { sessionId } = await confirmedSession("821", 1);
    expect(await analysisStore.load(sessionId, "analysis-a")).toBeNull();
  });

  test("only the current attempt may store results", async () => {
    const { token, sessionId } = await confirmedSession("822", 3);

    expect(await analysisStore.saveCoding(sessionId, "stale", coding())).toBe(
      false,
    );
    expect(
      await analysisStore.saveCoding(sessionId, "analysis-a", coding()),
    ).toBe(true);
    expect(
      await analysisStore.saveQuestions(sessionId, "analysis-a", questions()),
    ).toBe(true);

    expect(await getSessionByToken(token)).toMatchObject({
      status: "awaiting_reflection",
      analysis: { prompts: [{ code: "C5" }] },
      reflectionQuestions: { outcome: "insufficient_evidence" },
    });
    // The attempt is finished, so a late duplicate cannot overwrite anything.
    expect(
      await analysisStore.saveQuestions(sessionId, "analysis-a", questions()),
    ).toBe(false);
  });

  test("a failure keeps the coding, and a retry resumes from it", async () => {
    const { token, sessionId } = await confirmedSession("823", 2);
    await analysisStore.saveCoding(sessionId, "analysis-a", coding());
    await analysisStore.fail(sessionId, "analysis-a", "S2-OPENAI");

    expect(await getSessionByToken(token)).toMatchObject({
      status: "failed",
      errorCode: "S2-OPENAI",
    });
    expect(await retryAnalysis(token, "analysis-b")).toMatchObject({
      ok: true,
      session: { status: "processing", errorCode: null },
    });
    expect(await analysisStore.load(sessionId, "analysis-b")).toMatchObject({
      coding: { prompts: [{ code: "C5" }] },
    });
    expect(await analysisStore.load(sessionId, "analysis-a")).toBeNull();

    await analysisStore.fail(sessionId, "analysis-b", "S2-RATE-LIMIT");
    const stored = (
      await getDb().collection("sessions").doc(sessionId).get()
    ).data();
    expect(
      stored?.analysisFailures.map((f: { errorCode: string }) => f.errorCode),
    ).toEqual(["S2-OPENAI", "S2-RATE-LIMIT"]);
  });

  test("a running analysis can only be restarted once it looks interrupted", async () => {
    const fresh = await confirmedSession("824", 2);
    expect(await retryAnalysis(fresh.token, "analysis-b")).toEqual({
      ok: false,
      reason: "NOT_READY",
    });

    const stuck = await confirmedSession("825", 2, {
      confirmedAt: new Date(Date.now() - 10 * MINUTE),
    });
    expect(await retryAnalysis(stuck.token, "analysis-b")).toMatchObject({
      ok: true,
    });
  });

  test("finished analyses and lessons without analysis cannot be retried", async () => {
    const done = await confirmedSession("826", 3);
    await analysisStore.saveQuestions(
      done.sessionId,
      "analysis-a",
      questions(),
    );
    expect(await retryAnalysis(done.token, "analysis-b")).toEqual({
      ok: false,
      reason: "NOT_READY",
    });

    const lessonOne = await confirmedSession("827", 1);
    expect(await retryAnalysis(lessonOne.token, "analysis-b")).toEqual({
      ok: false,
      reason: "ALREADY_COMPLETED",
    });
  });

  test("runs end to end with the fake analyser", async () => {
    const { token, sessionId } = await confirmedSession("828", 2);
    await runAnalysis(sessionId, "analysis-a", {
      ...defaultRunDependencies(analysisStore),
      readConfig: () => ({ analyser: "fake", maxObservations: 3 }),
    });

    const session = await getSessionByToken(token);
    expect(session).toMatchObject({
      status: "awaiting_reflection",
      errorCode: null,
      analysis: { analyser: "fake", frameworkVersion: loadFramework().version },
      reflectionQuestions: { outcome: "observations" },
    });
    expect(session?.analysis?.prompts).toHaveLength(4);
    expect(session?.reflectionQuestions?.items).toHaveLength(3);
  });

  test("a replacement transcript clears the earlier analysis", async () => {
    const { token, sessionId } = await confirmedSession("829", 2);
    await analysisStore.saveCoding(sessionId, "analysis-a", coding());
    await beginTranscriptSubmission(token, "scrape-b", "link");
    await saveTranscriptSubmission(
      sessionId,
      token,
      "scrape-b",
      sampleTranscript(),
    );

    expect(await getSessionByToken(token)).toMatchObject({
      status: "awaiting_confirmation",
      analysis: null,
      reflectionQuestions: null,
      analysisStartedAt: null,
    });
    expect(await analysisStore.load(sessionId, "analysis-a")).toBeNull();
  });
});
