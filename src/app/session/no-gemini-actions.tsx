"use client";

import { useActionState } from "react";
import { ArrowLeft, Check } from "lucide-react";

import {
  completeNoGeminiAction,
  type ConfirmationState,
  reopenNoGeminiAction,
} from "@/app/session/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sv } from "@/lib/sv";

const EMPTY: ConfirmationState = { error: null };

export function NoGeminiActions({
  showComplete = false,
}: {
  showComplete?: boolean;
}) {
  const [backState, backAction, backPending] = useActionState(
    reopenNoGeminiAction,
    EMPTY,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completeNoGeminiAction,
    EMPTY,
  );
  const error = backState.error ?? completeState.error;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {showComplete ? (
          <form action={completeAction}>
            <Button type="submit" disabled={completePending} className="h-11">
              <Check data-icon="inline-start" />
              {completePending
                ? sv.session.noGeminiCompleting
                : sv.session.noGeminiComplete}
            </Button>
          </form>
        ) : null}
        <form action={backAction}>
          <Button
            type="submit"
            variant={showComplete ? "outline" : "link"}
            disabled={backPending}
            className={showComplete ? "h-11" : "px-0"}
          >
            <ArrowLeft data-icon="inline-start" />
            {backPending
              ? sv.session.noGeminiReopening
              : sv.session.noGeminiReopen}
          </Button>
        </form>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
