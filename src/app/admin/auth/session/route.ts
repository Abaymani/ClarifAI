import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createResearcherSession,
} from "@/lib/admin/auth";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 403 });
  }

  let idToken: string;
  try {
    const body = (await request.json()) as { idToken?: unknown };
    if (typeof body.idToken !== "string" || body.idToken.length > 20_000) {
      throw new Error("invalid token");
    }
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 });
  }

  try {
    const session = await createResearcherSession(idToken);
    if (!session) {
      return NextResponse.json(
        { error: "Det här Google-kontot har inte behörighet." },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, session.sessionCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error(
      "ADMIN-AUTH",
      error instanceof Error ? error.name : "unknown",
    );
    return NextResponse.json(
      { error: "Inloggningen kunde inte slutföras." },
      { status: 401 },
    );
  }
}
