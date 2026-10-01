"use client";

import { useActionState } from "react";

import {
  confirmTranscriptAction,
  rejectTranscriptAction,
} from "@/app/session/actions";
import { ChatBubble, ChatThread } from "@/app/session/chat-thread";
import { ExpandableText } from "@/app/session/expandable-text";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Transcript } from "@/lib/scraping/transcript";
import { sv } from "@/lib/sv";

const EMPTY = { error: null };

export function TranscriptPreview({ transcript }: { transcript: Transcript }) {
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmTranscriptAction,
    EMPTY,
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    rejectTranscriptAction,
    EMPTY,
  );
  const error = confirmState.error ?? rejectState.error;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-xl font-medium">
          {sv.session.previewHeading}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sv.session.previewIntro}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium">
          {transcript.source.title ?? "Gemini-chatt"}
        </span>
        <span className="shrink-0 text-muted-foreground">
          {sv.session.previewMessages(transcript.messages.length)}
        </span>
      </div>

      {transcript.warnings.length > 0 ? (
        <Alert>
          <AlertDescription>{sv.session.previewWarnings}</AlertDescription>
        </Alert>
      ) : null}

      <ChatThread className="max-h-[32rem] overflow-y-auto">
        {transcript.messages.map((message) => (
          <ChatBubble key={message.index} message={message}>
            <ExpandableText
              text={message.text}
              collapsible={message.role === "gemini"}
            />
          </ChatBubble>
        ))}
      </ChatThread>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={confirmAction}>
          <Button
            type="submit"
            disabled={confirming || rejecting}
            className="h-11 w-full sm:w-auto"
          >
            {confirming ? sv.session.confirming : sv.session.confirm}
          </Button>
        </form>
        <form action={rejectAction}>
          <Button
            type="submit"
            variant="outline"
            disabled={confirming || rejecting}
            className="h-11 w-full sm:w-auto"
          >
            {rejecting ? sv.session.rejecting : sv.session.reject}
          </Button>
        </form>
      </div>
    </div>
  );
}
