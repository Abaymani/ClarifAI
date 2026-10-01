import { ExpandableText } from "@/app/session/expandable-text";
import { MessageContent } from "@/app/session/message-content";
import { highlightExcerpt, surroundingMessages } from "@/lib/analysis/context";
import type { TranscriptMessage } from "@/lib/scraping/transcript";
import { sv } from "@/lib/sv";

// The quoted message in full, with the excerpt marked, between the messages that
// came right before and after it.
export function ChatContext({
  messages,
  excerpt,
}: {
  messages: TranscriptMessage[];
  excerpt: { message: number; text: string };
}) {
  const around = surroundingMessages(messages, excerpt.message);
  if (!around) {
    return (
      <blockquote className="border-l-2 pl-3 text-sm break-words whitespace-pre-wrap italic">
        <MessageContent text={excerpt.text} />
      </blockquote>
    );
  }
  const focus = highlightExcerpt(around.focus.text, excerpt.text);
  const focusText = `${focus.clippedStart ? "… " : ""}${focus.before}${focus.match ?? ""}${focus.after}${focus.clippedEnd ? " …" : ""}`;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {around.before ? <Neighbour message={around.before} /> : null}
      <article className="rounded-lg border bg-background p-3 shadow-xs">
        <Speaker message={around.focus} />
        <MessageContent text={focusText} highlight={focus.match} />
      </article>
      {around.after ? <Neighbour message={around.after} /> : null}
    </div>
  );
}

function Neighbour({ message }: { message: TranscriptMessage }) {
  return (
    <article className="rounded-lg bg-background/60 px-3 py-2 text-muted-foreground">
      <Speaker message={message} />
      <ExpandableText text={message.text} />
    </article>
  );
}

function Speaker({ message }: { message: TranscriptMessage }) {
  return (
    <div className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {message.index}.{" "}
      {message.role === "student"
        ? sv.session.previewStudent
        : sv.session.previewGemini}
    </div>
  );
}
