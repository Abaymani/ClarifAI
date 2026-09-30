"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { sv } from "@/lib/sv";

const POLL_MS = 3_000;

// The analysis runs on the server after the confirmation request has returned, so
// the page asks for fresh data until the session leaves "processing".
export function AnalysisPending() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border bg-muted/30 p-5 text-sm"
    >
      <LoaderCircle
        aria-hidden
        className="size-5 shrink-0 animate-spin text-muted-foreground"
      />
      {sv.session.analysingProgress}
    </div>
  );
}
