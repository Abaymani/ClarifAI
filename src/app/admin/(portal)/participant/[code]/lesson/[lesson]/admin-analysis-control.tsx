"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { requestAdminLessonAnalysisAction } from "@/app/admin/(portal)/analysis-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { AdminLessonAnalysisRequest } from "@/lib/admin/types";

export function AdminAnalysisControl({
  sessionId,
  eligible,
  alreadyAnalysed,
  initialRequest,
}: {
  sessionId: string;
  eligible: boolean;
  alreadyAnalysed: boolean;
  initialRequest: AdminLessonAnalysisRequest | null;
}) {
  const router = useRouter();
  const [optimisticRequest, setOptimisticRequest] =
    useState<AdminLessonAnalysisRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const request = initialRequest ?? optimisticRequest;

  useEffect(() => {
    if (request?.status !== "processing") return;
    const interval = window.setInterval(() => router.refresh(), 3_000);
    return () => window.clearInterval(interval);
  }, [request?.status, router]);

  function requestAnalysis() {
    const confirmed = window.confirm(
      "Beställ AI-analysen? Den kan bara beställas en gång för den här deltagaren och lektionen, oavsett forskare.",
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await requestAdminLessonAnalysisAction({ sessionId });
      if (result.ok) {
        setOptimisticRequest(result.request);
        router.refresh();
        return;
      }
      setError(result.error);
      if (result.alreadyRequested) router.refresh();
    });
  }

  const status = request?.status;
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles aria-hidden="true" className="size-4" />
            AI-analys
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Analysen läggs till i den färdiga inlämningen. Transkript,
            inlämningsstatus och deltagarens övriga data ändras inte.
          </p>
        </div>

        {status === "processing" ? (
          <Status icon={LoaderCircle} spin text="AI-analys pågår" />
        ) : status === "completed" || (alreadyAnalysed && !request) ? (
          <Status icon={CheckCircle2} text="AI-analys skapad" />
        ) : status === "failed" ? (
          <Status icon={TriangleAlert} text="AI-analysen misslyckades" />
        ) : (
          <Button
            type="button"
            onClick={requestAnalysis}
            disabled={!eligible || pending}
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {pending ? "Startar …" : "Skapa AI-analys"}
          </Button>
        )}
      </div>

      {!eligible && !request && !alreadyAnalysed ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Analysen kan beställas när lektionen är färdiginlämnad med ett
          transkript.
        </p>
      ) : null}
      {status === "failed" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Försöket är registrerat och kan inte köras igen. Felkod:{" "}
          {request?.errorCode ?? "S2-UNEXPECTED"}.
        </p>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

function Status({
  icon: Icon,
  text,
  spin = false,
}: {
  icon: typeof Sparkles;
  text: string;
  spin?: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium">
      <Icon
        aria-hidden="true"
        className={spin ? "size-4 animate-spin" : "size-4"}
      />
      {text}
    </span>
  );
}
