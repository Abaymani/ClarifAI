"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyTextButton({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // The clipboard can be blocked, for example outside a secure context.
      setState("failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={copy}>
        {state === "copied" ? <Check /> : <Copy />}
        {children}
      </Button>
      <span aria-live="polite" className="text-xs text-muted-foreground">
        {state === "copied"
          ? "Kopierat"
          : state === "failed"
            ? "Kunde inte kopiera"
            : null}
      </span>
    </div>
  );
}
