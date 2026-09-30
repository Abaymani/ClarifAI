"use client";

import { useActionState } from "react";
import { cn } from "cn";

import {
  submitReflectionAction,
  type ReflectionFormState,
} from "@/app/session/actions";
import { ChatContext } from "@/app/session/chat-context";
import { NoGeminiActions } from "@/app/session/no-gemini-actions";
import { useReflectionDrafts } from "@/app/session/use-reflection-drafts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type {
  ReflectionItem,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";
import { MAX_REFLECTION_ANSWER_LENGTH } from "@/lib/session/types";
import { sv } from "@/lib/sv";

const TONE: Record<ReflectionItem["groupKind"], string> = {
  reinforce:
    "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  reflect:
    "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30",
  general: "",
  no_transcript: "",
};

const EMPTY: ReflectionFormState = { error: null, fields: [] };

export function ReflectionQuestions({
  questions,
  messages,
  draftKey,
}: {
  questions: StoredReflectionQuestions;
  messages: TranscriptMessage[];
  draftKey: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitReflectionAction,
    EMPTY,
  );
  const { drafts, updateDraft } = useReflectionDrafts(
    draftKey,
    questions.items,
    pending,
  );
  const notices = [
    questions.frameworkStatus === "TEST" ? sv.session.reflectionTest : null,
    questions.analyser === "fake" ? sv.session.reflectionFake : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {questions.outcome === "no_transcript" ? <NoGeminiActions /> : null}

      <form action={formAction} className="flex flex-col gap-5">
        {notices.length > 0 ? (
          <Alert>
            <AlertDescription>{notices.join(" ")}</AlertDescription>
          </Alert>
        ) : null}

        {questions.items.map((item, i) => {
          const draft = drafts[item.id] ?? { answer: "", agreement: null };
          const answerField = `${item.id}:answer`;
          const agreementField = `${item.id}:agreement`;
          const hasAnalysis = item.basedOn !== null;
          const asksForExplanation =
            draft.agreement === "partly" || draft.agreement === "no";

          return (
            <section
              key={item.id}
              aria-labelledby={`${item.id}-heading`}
              data-tone={item.groupKind}
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-5",
                TONE[item.groupKind],
              )}
            >
              <h2
                id={`${item.id}-heading`}
                className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
              >
                {item.excerpt
                  ? sv.session.reflectionExample(i + 1)
                  : sv.session.reflectionGeneral}
              </h2>

              {item.excerpt ? (
                <ChatContext messages={messages} excerpt={item.excerpt} />
              ) : null}

              {hasAnalysis ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      {sv.session.reflectionAnalysisLabel}
                    </p>
                    <p className="border-l-2 pl-3 text-sm">{item.intro}</p>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
                    {sv.session.reflectionAnalysisCaveat}
                  </div>
                </div>
              ) : (
                <p className="text-sm">{item.intro}</p>
              )}

              {hasAnalysis ? (
                <fieldset
                  className="flex flex-col gap-2"
                  aria-invalid={state.fields.includes(agreementField)}
                >
                  <legend className="mb-1 text-sm font-medium">
                    {sv.session.reflectionAgreementLegend}
                  </legend>
                  <RadioGroup
                    className="grid grid-cols-3 gap-2"
                    value={draft.agreement ?? ""}
                    onValueChange={(value) =>
                      updateDraft(item.id, {
                        agreement:
                          value === "yes" ||
                          value === "partly" ||
                          value === "no"
                            ? value
                            : null,
                      })
                    }
                  >
                    {(["yes", "partly", "no"] as const).map((agreement) => (
                      <Label
                        key={agreement}
                        htmlFor={`${item.id}-agreement-${agreement}`}
                        className={cn(
                          "h-11 justify-center rounded-lg border bg-background px-2 font-normal",
                          draft.agreement === agreement &&
                            "border-primary ring-1 ring-primary",
                        )}
                      >
                        <RadioGroupItem
                          id={`${item.id}-agreement-${agreement}`}
                          value={agreement}
                        />
                        {sv.session.reflectionAgreement(agreement)}
                      </Label>
                    ))}
                  </RadioGroup>
                  <input
                    type="hidden"
                    name={agreementField}
                    value={draft.agreement ?? ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    {sv.session.reflectionAgreementHelp}
                  </p>
                </fieldset>
              ) : null}

              {asksForExplanation ? (
                <div
                  role="status"
                  data-explanation
                  className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30"
                >
                  {draft.agreement === "partly"
                    ? sv.session.reflectionExplainPartly
                    : sv.session.reflectionExplainNo}
                </div>
              ) : null}

              <div className="flex flex-col gap-1" data-reflection-questions>
                <p className="text-sm font-medium">
                  {sv.session.reflectionQuestions}
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                  {item.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor={`${item.id}-answer`}>
                  {hasAnalysis
                    ? sv.session.reflectionPerspectiveLabel
                    : sv.session.reflectionAnswerLabel}
                </Label>
                <Textarea
                  id={`${item.id}-answer`}
                  name={answerField}
                  required
                  maxLength={MAX_REFLECTION_ANSWER_LENGTH}
                  placeholder={item.tip ?? undefined}
                  className="min-h-28 bg-background"
                  value={draft.answer}
                  onChange={(event) =>
                    updateDraft(item.id, { answer: event.target.value })
                  }
                  aria-invalid={state.fields.includes(answerField)}
                />
              </div>
            </section>
          );
        })}

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={pending} className="h-11 self-start">
          {pending
            ? sv.session.reflectionSubmitting
            : sv.session.reflectionSubmit}
        </Button>
      </form>
    </div>
  );
}
