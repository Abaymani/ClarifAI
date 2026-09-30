"use client";

import { cn } from "cn";
import { useState } from "react";

import { sv } from "@/lib/sv";

// Gemini's answers can run to many paragraphs; the first lines are usually enough
// to remind the student of the situation.
export function ExpandableText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 240 || text.split("\n").length > 3;

  return (
    <div>
      <p
        className={cn(
          "break-words whitespace-pre-wrap",
          long && !open && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-medium text-foreground underline-offset-2 hover:underline"
        >
          {open ? sv.session.contextShowLess : sv.session.contextShowMore}
        </button>
      ) : null}
    </div>
  );
}
