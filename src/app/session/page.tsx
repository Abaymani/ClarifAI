import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions";
import { TranscriptForm } from "@/app/session/transcript-form";
import { TranscriptPreview } from "@/app/session/transcript-preview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { SESSION_COOKIE } from "@/lib/session/session-token";
import { getSessionByToken } from "@/lib/session/store";
import { sv } from "@/lib/sv";

export default async function SessionPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/");

  const session = await getSessionByToken(token);
  if (!session) redirect("/");
  if (session.status === "completed") redirect("/");

  const awaitingConfirmation =
    session.status === "awaiting_confirmation" && session.transcript;
  const confirmed = session.transcriptConfirmedAt !== null;
  const status = confirmed
    ? sv.session.statusTranscriptConfirmed
    : awaitingConfirmation
      ? sv.session.statusAwaitingConfirmation
      : session.status === "processing"
        ? sv.session.statusProcessing
        : sv.session.statusAwaitingTranscript;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {sv.session.participant(session.participantCode, session.lesson)}
        </span>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            {sv.session.logout}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {status}
          </span>
          <h1 className="font-heading text-2xl leading-snug font-medium">
            {confirmed ? sv.session.confirmedHeading : sv.session.heading}
          </h1>
          <CardDescription>
            {confirmed ? sv.session.confirmedIntro : sv.session.intro}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {confirmed ? null : awaitingConfirmation ? (
            <TranscriptPreview transcript={session.transcript!} />
          ) : (
            <div className="flex flex-col gap-4 rounded-xl border p-5">
              <h2 className="text-sm font-medium">
                {sv.session.transcriptHeading}
              </h2>
              <TranscriptForm
                initialError={
                  session.errorCode
                    ? sv.errors.transcriptRetry(session.errorCode)
                    : null
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
