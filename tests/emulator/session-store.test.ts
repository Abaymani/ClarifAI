import { describe, expect, test } from "vitest";

import { getDb } from "@/lib/firebase/admin";
import { LOCKOUT_MINUTES } from "@/lib/session/credentials";
import {
  createSessionToken,
  hashSessionToken,
} from "@/lib/session/session-token";
import {
  ensureParticipants,
  getSessionByToken,
  startSession,
} from "@/lib/session/store";

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
