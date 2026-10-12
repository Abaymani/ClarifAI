import { Sparkles, UserRound } from "lucide-react";

import type { ResearcherId } from "@/lib/admin/auth";

export type CodingSourceBadgeData = {
  source: "ai" | ResearcherId;
  label: string;
  code: string;
  name?: string;
};

export function CodingSourceBadge({
  source,
  label,
  code,
  name,
}: CodingSourceBadgeData) {
  const tone =
    source === "ai"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
      : source === "R1"
        ? "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100"
        : "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-100";
  const Icon = source === "ai" ? Sparkles : UserRound;

  return (
    <span
      tabIndex={name ? 0 : undefined}
      aria-label={name ? `${label}: ${code} · ${name}` : undefined}
      className={`group relative inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] leading-4 font-semibold tracking-normal whitespace-nowrap ${tone}`}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label} · {code}
      {name ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-center text-xs font-medium text-background opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus:opacity-100"
        >
          {code} · {name}
        </span>
      ) : null}
    </span>
  );
}
