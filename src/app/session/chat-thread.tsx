import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { MessagesSquare } from "lucide-react";
import { cn } from "cn";

import type { TranscriptMessage } from "@/lib/scraping/transcript";
import { sv } from "@/lib/sv";

export function ChatThread({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl border bg-muted/30 p-3",
        className,
      )}
    >
      {label ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <MessagesSquare aria-hidden="true" className="size-4" />
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

type ChatBubbleProps = Omit<ComponentPropsWithoutRef<"article">, "children"> & {
  message: TranscriptMessage;
  children: ReactNode;
  headerActions?: ReactNode;
  headerLabel?: string;
};

export function ChatBubble({
  message,
  children,
  className,
  headerActions,
  headerLabel,
  ...articleProps
}: ChatBubbleProps) {
  const student = message.role === "student";

  return (
    <article
      {...articleProps}
      data-chat-role={message.role}
      className={cn(
        "min-w-0 rounded-xl px-3 py-2.5 text-sm break-words sm:px-4 sm:py-3",
        student
          ? "w-[82%] self-end rounded-br-sm bg-blue-50 text-blue-950 sm:w-[70%] dark:bg-blue-950/40 dark:text-blue-50"
          : "w-[94%] self-start rounded-bl-sm border bg-background shadow-xs sm:w-[84%]",
        className,
      )}
    >
      <div
        className={cn(
          "mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
          student && "text-blue-700 dark:text-blue-300",
          headerActions
            ? "flex items-start justify-between gap-2"
            : student && "text-right",
        )}
      >
        <span>
          {headerLabel ?? (
            <>
              {message.index}.{" "}
              {student ? sv.session.previewStudent : sv.session.previewGemini}
            </>
          )}
        </span>
        {headerActions}
      </div>
      {children}
    </article>
  );
}
