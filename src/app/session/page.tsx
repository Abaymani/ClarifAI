import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SESSION_COOKIE } from "@/lib/session/session-token";
import { getSessionByToken } from "@/lib/session/store";
import { sv } from "@/lib/sv";

export default async function SessionPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) redirect("/");

  const session = await getSessionByToken(token);
  if (!session) redirect("/");

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
            {sv.session.statusAwaitingTranscript}
          </span>
          <h1 className="font-heading text-2xl leading-snug font-medium">
            {sv.session.heading}
          </h1>
          <CardDescription>{sv.session.intro}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Placeholder until S1; the field is disabled so nothing can be submitted yet. */}
          <div className="flex flex-col gap-3 rounded-xl border border-dashed p-5">
            <span className="text-sm font-medium">
              {sv.session.transcriptHeading}
            </span>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transcript-link" className="font-normal">
                {sv.session.transcriptLabel}
              </Label>
              <Input
                id="transcript-link"
                name="transcript-link"
                type="url"
                inputMode="url"
                disabled
                placeholder={sv.session.transcriptPlaceholder}
                className="h-11"
              />
            </div>
            <Button type="button" disabled className="h-11 self-start">
              {sv.session.transcriptSubmit}
            </Button>
            <p className="text-sm text-muted-foreground">
              {sv.session.transcriptComingSoon}
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
