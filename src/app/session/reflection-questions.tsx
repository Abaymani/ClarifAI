import { cn } from "cn";

import { ChatContext } from "@/app/session/chat-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  ReflectionItem,
  StoredReflectionQuestions,
} from "@/lib/analysis/types";
import type { TranscriptMessage } from "@/lib/scraping/transcript";
import { sv } from "@/lib/sv";

// A light tint tells reinforcement (F groups) from reflection (R groups); the
// general question stays neutral.
const TONE: Record<ReflectionItem["groupKind"], string> = {
  reinforce:
    "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  reflect:
    "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30",
  general: "",
};

// Shows what S2 produced. Answering (S3) comes next, so the answer fields are
// visible but not yet usable.
export function ReflectionQuestions({
  questions,
  messages,
}: {
  questions: StoredReflectionQuestions;
  messages: TranscriptMessage[];
}) {
  const notices = [
    questions.frameworkStatus === "TEST" ? sv.session.reflectionTest : null,
    questions.analyser === "fake" ? sv.session.reflectionFake : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-5">
      {notices.length > 0 ? (
        <Alert>
          <AlertDescription>{notices.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      {questions.items.map((item, i) => (
        <section
          key={item.id}
          aria-labelledby={`${item.id}-heading`}
          data-tone={item.groupKind}
          className={cn(
            "flex flex-col gap-3 rounded-xl border p-5",
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

          <p className="text-sm">{item.intro}</p>

          {/* Suggestions: the student writes one free-text answer per example. */}
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {sv.session.reflectionQuestions}
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {item.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>

          {item.tip ? (
            <p className="text-sm text-muted-foreground">
              {sv.session.reflectionTip(item.tip)}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${item.id}-answer`}>
              {sv.session.reflectionAnswerLabel}
            </Label>
            <Textarea
              id={`${item.id}-answer`}
              disabled
              className="bg-background"
              aria-describedby={`${item.id}-answer-note`}
            />
            <p
              id={`${item.id}-answer-note`}
              className="text-xs text-muted-foreground"
            >
              {sv.session.reflectionAnswerSoon}
            </p>
          </div>
        </section>
      ))}
    </div>
  );
}
