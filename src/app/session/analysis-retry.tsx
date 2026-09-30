"use client";

import { useActionState } from "react";

import { retryAnalysisAction } from "@/app/session/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sv } from "@/lib/sv";

const EMPTY = { error: null };

export function AnalysisRetry({ failure }: { failure: string }) {
  const [state, retryAction, retrying] = useActionState(
    retryAnalysisAction,
    EMPTY,
  );

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertDescription>{state.error ?? failure}</AlertDescription>
      </Alert>
      <form action={retryAction}>
        <Button type="submit" disabled={retrying} className="h-11">
          {retrying ? sv.session.analysisRetrying : sv.session.analysisRetry}
        </Button>
      </form>
    </div>
  );
}
