"use client";

import { cn } from "cn";
import { useId, useState } from "react";

import { MessageContent } from "@/app/session/message-content";
import { sv } from "@/lib/sv";

// Gemini's answers can run to many paragraphs; the first lines are usually enough
// to identify the response, while student messages should remain visible in full.
export function ExpandableText({
  text,
  highlight,
  collapsible = true,
}: {
  text: string;
  highlight?: string | null;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const long =
    collapsible && (text.length > 240 || text.split("\n").length > 3);

  return (
    <div>
      <div
        id={contentId}
        className={cn(
          "relative break-words",
          long &&
            !open &&
            "max-h-28 overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-8 after:bg-linear-to-b after:from-transparent after:to-background",
        )}
      >
        <MessageContent text={text} highlight={highlight} />
      </div>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          {open ? sv.session.contextShowLess : sv.session.contextShowMore}
        </button>
      ) : null}
    </div>
  );
}
