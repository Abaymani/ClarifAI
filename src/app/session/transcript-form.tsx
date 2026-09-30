"use client";

import { useActionState, useState } from "react";

import {
  declareNoGeminiAction,
  type NoGeminiState,
  submitTranscriptAction,
  type TranscriptFormState,
} from "@/app/session/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sv } from "@/lib/sv";
import { cn } from "cn";

export function TranscriptForm({
  initialError,
  lesson,
}: {
  initialError: string | null;
  lesson: number;
}) {
  const initialState: TranscriptFormState = {
    error: initialError,
    field: null,
  };
  const [state, formAction, pending] = useActionState(
    submitTranscriptAction,
    initialState,
  );
  const noGeminiInitial: NoGeminiState = { error: null };
  const [noGeminiState, noGeminiAction, noGeminiPending] = useActionState(
    declareNoGeminiAction,
    noGeminiInitial,
  );
  const [link, setLink] = useState("");
  const [geminiUse, setGeminiUse] = useState<"used" | "not_used">("used");
  const errorId = state.error ? "transcript-error" : undefined;

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">
          {sv.session.geminiUseLegend}
        </legend>
        <RadioGroup
          className="grid gap-3 sm:grid-cols-2"
          value={geminiUse}
          onValueChange={(value) =>
            setGeminiUse(value === "not_used" ? "not_used" : "used")
          }
        >
          {(["used", "not_used"] as const).map((option) => (
            <Label
              key={option}
              htmlFor={`gemini-use-${option}`}
              className={cn(
                "items-start gap-3 rounded-xl border p-4 font-normal",
                geminiUse === option && "border-primary ring-1 ring-primary",
              )}
            >
              <RadioGroupItem
                id={`gemini-use-${option}`}
                value={option}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">
                  {option === "used"
                    ? sv.session.geminiUsed
                    : sv.session.geminiNotUsed}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {option === "used"
                    ? sv.session.geminiUsedHelp
                    : sv.session.geminiNotUsedHelp}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      {geminiUse === "used" ? (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="transcript-link">
              {sv.session.transcriptLabel}
            </Label>
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
      ) : (
        <form action={noGeminiAction} className="flex flex-col gap-4">
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">{sv.session.noGeminiConfirmation}</p>
            <p className="mt-1 text-muted-foreground">
              {lesson === 2 || lesson === 3
                ? sv.session.noGeminiReflectionExplanation
                : sv.session.noGeminiCompletionExplanation}
            </p>
          </div>
          {noGeminiState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{noGeminiState.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            disabled={noGeminiPending}
            className="h-11 self-start"
          >
            {noGeminiPending
              ? sv.session.noGeminiSubmitting
              : sv.session.noGeminiSubmit}
          </Button>
        </form>
      )}
    </div>
  );
}
