import { CircleCheck } from "lucide-react";

import { NoGeminiActions } from "@/app/session/no-gemini-actions";
import { sv } from "@/lib/sv";

export function NoGeminiConfirmation() {
  return (
    <div className="flex flex-col items-center gap-5 py-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50 dark:bg-emerald-900/60 dark:text-emerald-200 dark:ring-emerald-950/50">
        <CircleCheck className="size-7" aria-hidden="true" />
      </div>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="font-heading text-xl font-medium">
          {sv.session.noGeminiSuccess}
        </h2>
        <p className="text-sm text-muted-foreground">
          {sv.session.noGeminiReview}
        </p>
      </div>
      <NoGeminiActions showComplete />
    </div>
  );
}
