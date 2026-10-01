import { ExpandableText } from "@/app/session/expandable-text";
import { ChatBubble, ChatThread } from "@/app/session/chat-thread";
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
      <ChatThread label={sv.session.reflectionChatExcerpt} className="text-sm">
        <blockquote className="border-l-2 pl-3 break-words italic">
          <MessageContent text={excerpt.text} />
        </blockquote>
      </ChatThread>
    );
  }
  const focus = highlightExcerpt(around.focus.text, excerpt.text);
  const focusText = `${focus.clippedStart ? "… " : ""}${focus.before}${focus.match ?? ""}${focus.after}${focus.clippedEnd ? " …" : ""}`;

  return (
    <ChatThread label={sv.session.reflectionChatExcerpt} className="text-sm">
      {around.before ? <Neighbour message={around.before} /> : null}
      <ChatBubble message={around.focus} className="ring-1 ring-foreground/10">
        <MessageContent text={focusText} highlight={focus.match} />
      </ChatBubble>
      {around.after ? <Neighbour message={around.after} /> : null}
    </ChatThread>
  );
}

function Neighbour({ message }: { message: TranscriptMessage }) {
  return (
    <ChatBubble message={message}>
      <ExpandableText text={message.text} />
    </ChatBubble>
  );
}
