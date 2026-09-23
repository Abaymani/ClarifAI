"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  CredentialError,
  normaliseParticipantCode,
  normalisePin,
  parseLesson,
  type CredentialProblem,
  type Lesson,
} from "@/lib/session/credentials";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/session/session-token";
import { startSession } from "@/lib/session/store";
import { sv } from "@/lib/sv";

export type LoginState = { error: string | null };

export async function startSessionAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  let credentials: { code: string; pin: string; lesson: Lesson };
  try {
    credentials = {
      code: normaliseParticipantCode(String(formData.get("code") ?? "")),
      pin: normalisePin(String(formData.get("pin") ?? "")),
      lesson: parseLesson(formData.get("lesson") as string | null),
    };
  } catch (error) {
    if (error instanceof CredentialError) {
      return { error: messageForProblem(error.problem) };
    }
    throw error;
  }

  const token = createSessionToken();
  let result;
  try {
    result = await startSession(credentials, hashSessionToken(token));
  } catch (error) {
    // Never log the code, the PIN or anything else the student typed.
    console.error("S0-DB", error instanceof Error ? error.name : "unknown");
    return { error: sv.errors.unexpected("S0-DB") };
  }

  if (!result.ok) {
    switch (result.reason) {
      case "UNKNOWN_CODE":
        return { error: sv.errors.codeUnknown };
      case "WRONG_PIN":
        return { error: sv.errors.pinWrong(result.attemptsLeft) };
      case "LOCKED":
        return { error: sv.errors.locked(result.minutesLeft) };
      case "ALREADY_COMPLETED":
        return { error: sv.errors.lessonCompleted(credentials.lesson) };
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  redirect("/session");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}

function messageForProblem(problem: CredentialProblem): string {
  switch (problem) {
    case "CODE_MISSING":
      return sv.errors.codeMissing;
    case "CODE_FORMAT":
      return sv.errors.codeFormat;
    case "PIN_MISSING":
      return sv.errors.pinMissing;
    case "PIN_FORMAT":
      return sv.errors.pinFormat;
    case "LESSON_MISSING":
      return sv.errors.lessonMissing;
  }
}
