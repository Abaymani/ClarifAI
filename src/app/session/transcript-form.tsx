"use client";

import { useActionState, useState } from "react";

import {
  submitTranscriptAction,
  type TranscriptFormState,
} from "@/app/session/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sv } from "@/lib/sv";

export function TranscriptForm({
  initialError,
}: {
  initialError: string | null;
}) {
  const initialState: TranscriptFormState = {
    error: initialError,
    field: null,
  };
  const [state, formAction, pending] = useActionState(
    submitTranscriptAction,
    initialState,
  );
  const [link, setLink] = useState("");
  const errorId = state.error ? "transcript-error" : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="transcript-link">{sv.session.transcriptLabel}</Label>
        <Input
          id="transcript-link"
          name="transcript-link"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={sv.session.transcriptPlaceholder}
          className="h-11"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          aria-invalid={state.field === "link"}
          aria-describedby={state.error ? errorId : "transcript-help"}
        />
        <p id="transcript-help" className="text-sm text-muted-foreground">
          {sv.session.transcriptHelp}
        </p>
      </div>

      {state.error ? (
        <Alert variant="destructive" id={errorId}>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 self-start">
        {pending
          ? sv.session.transcriptSubmitting
          : sv.session.transcriptSubmit}
      </Button>
    </form>
  );
}
