import { describe, expect, test } from "vitest";

import { noTranscriptReflection } from "@/lib/analysis/reflection";
import { testFramework } from "@/lib/analysis/test-fixtures";
import type { StoredReflectionQuestions } from "@/lib/analysis/types";
import { getDb } from "@/lib/firebase/admin";
import type { Transcript } from "@/lib/scraping/transcript";
import { LOCKOUT_MINUTES } from "@/lib/session/credentials";
import {
  createSessionToken,
  hashSessionToken,
} from "@/lib/session/session-token";
import {
  ensureParticipants,
  beginTranscriptSubmission,
  completeReflection,
  confirmTranscript,
  declareNoGeminiUse,
  failTranscriptSubmission,
  getSessionByToken,
  rejectTranscript,
  saveTranscriptSubmission,
  startSession,
  TranscriptTooLargeError,
} from "@/lib/session/store";

function r01Questions(): StoredReflectionQuestions {
  const framework = testFramework();
  return {
    ...noTranscriptReflection(framework),
    frameworkVersion: framework.version,
    frameworkStatus: framework.status,
    analyser: "none",
    model: null,
    reasoningEffort: null,
    createdAt: "2026-09-30T12:00:00.000Z",
    durationMs: 0,
    usage: null,
  };
}

function transcript(title: string): Transcript {
  return {
    source: {
      submittedLink: "https://gemini.google.com/share/abc123def456",
      shareUrl: "https://gemini.google.com/share/abc123def456",
      title,
      model: "Gemini",
      sharedAt: null,
    },
    retrievedAt: "2026-09-23T10:00:00.000Z",
    parserVersion: 1,
    messages: [
      { index: 1, role: "student", text: "Hur kopplar jag lysdioden?" },
      { index: 2, role: "gemini", text: "Använd ett motstånd i serie." },
    ],
    warnings: [],
  };
}

// Each test uses its own code, because the emulator keeps data for the whole run.
async function seed(code: string, pin: string): Promise<void> {
  await getDb()
    .collection("participants")
    .doc(code)
    .set({ code, pin, failedAttempts: 0, lockedUntil: null });
}

describe("ensureParticipants", () => {
  test("creates codes once and never changes a PIN already handed out", async () => {
    const created = await ensureParticipants([{ code: "801", pin: "1111" }]);
    expect(created).toEqual([{ code: "801", pin: "1111", created: true }]);

    const again = await ensureParticipants([{ code: "801", pin: "2222" }]);
    expect(again).toEqual([{ code: "801", pin: "1111", created: false }]);
  });
});

describe("startSession", () => {
  test("refuses a code that was never handed out", async () => {
    const result = await startSession(
      { code: "802", pin: "1234", lesson: 1 },
      hashSessionToken(createSessionToken()),
    );
    expect(result).toEqual({ ok: false, reason: "UNKNOWN_CODE" });
  });

  test("counts wrong PINs and blocks the code on the third", async () => {
    await seed("803", "4321");
    const wrong = { code: "803", pin: "0000", lesson: 2 } as const;
    const hash = hashSessionToken(createSessionToken());

    expect(await startSession(wrong, hash)).toEqual({
      ok: false,
      reason: "WRONG_PIN",
      attemptsLeft: 2,
    });
    expect(await startSession(wrong, hash)).toEqual({
      ok: false,
      reason: "WRONG_PIN",
      attemptsLeft: 1,
    });
    expect(await startSession(wrong, hash)).toEqual({
      ok: false,
      reason: "LOCKED",
      minutesLeft: LOCKOUT_MINUTES,
    });

    // Even the right PIN has to wait once the code is blocked.
    const blocked = await startSession({ ...wrong, pin: "4321" }, hash);
    expect(blocked).toMatchObject({ ok: false, reason: "LOCKED" });
  });

  test("starts a session, then resumes the same one for that lesson", async () => {
    await seed("804", "4321");
    const credentials = { code: "804", pin: "4321", lesson: 3 } as const;

    const firstToken = createSessionToken();
    const first = await startSession(credentials, hashSessionToken(firstToken));
    expect(first).toMatchObject({
      ok: true,
      session: {
        id: "804_3",
        participantCode: "804",
        lesson: 3,
        status: "awaiting_transcript",
      },
    });

    const secondToken = createSessionToken();
    const second = await startSession(
      credentials,
      hashSessionToken(secondToken),
    );
    expect(second).toMatchObject({ ok: true, session: { id: "804_3" } });

    // Logging in again replaces the cookie, so the previous one stops working.
    expect(await getSessionByToken(secondToken)).toMatchObject({ id: "804_3" });
    expect(await getSessionByToken(firstToken)).toBeNull();

    const sessions = await getDb()
      .collection("sessions")
      .where("participantCode", "==", "804")
      .get();
    expect(sessions.size).toBe(1);
  });

  test("clears earlier wrong attempts once the PIN is right", async () => {
    await seed("805", "4321");
    await startSession({ code: "805", pin: "0000", lesson: 1 }, "hash-a");
    await startSession({ code: "805", pin: "4321", lesson: 1 }, "hash-b");

    const participant = await getDb()
      .collection("participants")
      .doc("805")
      .get();
    expect(participant.data()).toMatchObject({
      failedAttempts: 0,
      lockedUntil: null,
    });
  });

  test("will not reopen a lesson that is already handed in", async () => {
    await seed("806", "4321");
    const credentials = { code: "806", pin: "4321", lesson: 4 } as const;
    await startSession(credentials, hashSessionToken(createSessionToken()));
    await getDb()
      .collection("sessions")
      .doc("806_4")
      .update({ status: "completed" });

    expect(await startSession(credentials, "hash-c")).toEqual({
      ok: false,
      reason: "ALREADY_COMPLETED",
    });
  });
});

describe("getSessionByToken", () => {
  test("gives nothing for a token that is not in use", async () => {
    expect(await getSessionByToken(createSessionToken())).toBeNull();
  });
});

describe("transcript lifecycle", () => {
  async function startedSession(code: string, lesson: 1 | 2 | 3 | 4) {
    await seed(code, "4321");
    const token = createSessionToken();
    const result = await startSession(
      { code, pin: "4321", lesson },
      hashSessionToken(token),
    );
    if (!result.ok)
      throw new Error(`Could not start session: ${result.reason}`);
    return { token, sessionId: result.session.id };
  }

  test("stores a scraped transcript for confirmation", async () => {
    const { token, sessionId } = await startedSession("807", 2);
    await beginTranscriptSubmission(
      token,
      "attempt-a",
      "https://gemini.google.com/share/abc123def456",
    );
    const saved = await saveTranscriptSubmission(
      sessionId,
      token,
      "attempt-a",
      transcript("LED chat"),
    );

    expect(saved).toMatchObject({
      ok: true,
      session: {
        status: "awaiting_confirmation",
        transcript: { source: { title: "LED chat" } },
      },
    });
    expect(await getSessionByToken(token)).toMatchObject({
      status: "awaiting_confirmation",
      transcript: { messages: [{ role: "student" }, { role: "gemini" }] },
    });
  });

  test("keeps the saved transcript when a replacement fails", async () => {
    const { token, sessionId } = await startedSession("808", 3);
    await beginTranscriptSubmission(token, "attempt-a", "first-link");
    await saveTranscriptSubmission(
      sessionId,
      token,
      "attempt-a",
      transcript("Original"),
    );
    await rejectTranscript(token);
    await beginTranscriptSubmission(token, "attempt-b", "replacement-link");
    await failTranscriptSubmission(
      sessionId,
      token,
      "attempt-b",
      "S1-NOT_FOUND",
    );

    expect(await getSessionByToken(token)).toMatchObject({
      status: "failed",
      errorCode: "S1-NOT_FOUND",
      transcript: { source: { title: "Original" } },
    });
  });

  test("does not let an older scrape overwrite a newer attempt", async () => {
    const { token, sessionId } = await startedSession("809", 2);
    await beginTranscriptSubmission(token, "slow", "slow-link");
    await beginTranscriptSubmission(token, "new", "new-link");

    expect(
      await saveTranscriptSubmission(
        sessionId,
        token,
        "slow",
        transcript("Stale"),
      ),
    ).toEqual({ ok: false, reason: "STALE" });
    await saveTranscriptSubmission(
      sessionId,
      token,
      "new",
      transcript("Current"),
    );
    expect(await getSessionByToken(token)).toMatchObject({
      transcript: { source: { title: "Current" } },
    });
  });

  test("rejects a transcript that cannot fit in the session document", async () => {
    const { token, sessionId } = await startedSession("813", 2);
    await beginTranscriptSubmission(token, "attempt-a", "large-link");
    const tooLarge = transcript("Large chat");
    tooLarge.messages[0].text = "x".repeat(850_000);

    await expect(
      saveTranscriptSubmission(sessionId, token, "attempt-a", tooLarge),
    ).rejects.toBeInstanceOf(TranscriptTooLargeError);
  });

  test("rejects a preview without deleting the saved transcript", async () => {
    const { token, sessionId } = await startedSession("810", 2);
    await beginTranscriptSubmission(token, "attempt-a", "first-link");
    await saveTranscriptSubmission(
      sessionId,
      token,
      "attempt-a",
      transcript("Wrong chat"),
    );

    expect(await rejectTranscript(token)).toMatchObject({
      ok: true,
      session: {
        status: "awaiting_transcript",
        transcript: { source: { title: "Wrong chat" } },
      },
    });
  });

  test("confirmation completes lessons 1 and 4", async () => {
    const { token, sessionId } = await startedSession("811", 1);
    await beginTranscriptSubmission(token, "attempt-a", "first-link");
    await saveTranscriptSubmission(
      sessionId,
      token,
      "attempt-a",
      transcript("Lesson one"),
    );

    const confirmed = await confirmTranscript(token);
    expect(confirmed).toMatchObject({
      ok: true,
      session: { status: "completed" },
    });
    if (confirmed.ok) {
      expect(confirmed.session.transcriptConfirmedAt).toBeInstanceOf(Date);
      expect(confirmed.session.completedAt).toBeInstanceOf(Date);
    }
  });

  test("confirmation advances lessons 2 and 3 to analysis", async () => {
    const { token, sessionId } = await startedSession("812", 3);
    await beginTranscriptSubmission(token, "attempt-a", "first-link");
    await saveTranscriptSubmission(
      sessionId,
      token,
      "attempt-a",
      transcript("Lesson three"),
    );

    expect(await confirmTranscript(token)).toMatchObject({
      ok: true,
      session: { status: "processing", completedAt: null },
    });
  });

  test("records no Gemini and completes lessons 1 and 4", async () => {
    const { token, sessionId } = await startedSession("814", 4);

    const result = await declareNoGeminiUse(token, null);
    expect(result).toMatchObject({
      ok: true,
      session: {
        status: "completed",
        transcriptSubmission: "no_gemini",
        transcript: null,
        reflectionQuestions: null,
      },
    });
    expect(
      (await getDb().collection("sessions").doc(sessionId).get()).data(),
    ).toMatchObject({ status: "completed", transcriptSubmission: "no_gemini" });
  });

  test("goes directly to R01 in lessons 2 and 3 and invalidates a pending scrape", async () => {
    const { token, sessionId } = await startedSession("815", 2);
    await beginTranscriptSubmission(token, "old-attempt", "old-link");

    const result = await declareNoGeminiUse(token, r01Questions());
    expect(result).toMatchObject({
      ok: true,
      session: {
        status: "awaiting_reflection",
        transcriptSubmission: "no_gemini",
        reflectionQuestions: {
          outcome: "no_transcript",
          items: [{ group: "R01", groupKind: "no_transcript" }],
        },
      },
    });
    expect(
      await saveTranscriptSubmission(
        sessionId,
        token,
        "old-attempt",
        transcript("Too late"),
      ),
    ).toEqual({ ok: false, reason: "STALE" });
  });

  test("saves the R01 answer and completes the reflection", async () => {
    const { token } = await startedSession("816", 3);
    await declareNoGeminiUse(token, r01Questions());

    const result = await completeReflection(token, [
      { itemId: "q1", answer: "Jag ville prova själv.", agreement: null },
    ]);
    expect(result).toMatchObject({
      ok: true,
      session: {
        status: "completed",
        reflectionResponses: {
          items: [
            {
              itemId: "q1",
              answer: "Jag ville prova själv.",
              agreement: null,
            },
          ],
        },
      },
    });
  });

  test("requires an agreement for each concrete analysis", async () => {
    const { token, sessionId } = await startedSession("817", 2);
    const questions = r01Questions();
    questions.outcome = "observations";
    questions.items[0] = {
      ...questions.items[0],
      group: "R1",
      groupKind: "reflect",
      basedOn: {
        kind: "prompt",
        code: "P1",
        firstMessage: 1,
        lastMessage: 1,
      },
      excerpt: { message: 1, text: "Gör det åt mig" },
    };
    await getDb().collection("sessions").doc(sessionId).update({
      status: "awaiting_reflection",
      reflectionQuestions: questions,
    });

    expect(
      await completeReflection(token, [
        {
          itemId: "q1",
          answer: "Analysen missar mitt försök.",
          agreement: null,
        },
      ]),
    ).toEqual({ ok: false, reason: "INVALID_RESPONSE" });
    expect(
      await completeReflection(token, [
        {
          itemId: "q1",
          answer: "Analysen missar mitt försök.",
          agreement: "no",
        },
      ]),
    ).toMatchObject({ ok: true, session: { status: "completed" } });
  });
});
