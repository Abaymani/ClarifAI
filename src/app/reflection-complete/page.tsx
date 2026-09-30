import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sv } from "@/lib/sv";
import { cn } from "cn";

export default function ReflectionCompletePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-lg flex-1 items-center justify-center overflow-hidden p-6">
      <span
        aria-hidden="true"
        className="absolute top-[18%] left-[8%] text-xl text-emerald-500/60"
      >
        ●
      </span>
      <span
        aria-hidden="true"
        className="absolute top-[12%] right-[14%] text-lg text-amber-500/70"
      >
        ◆
      </span>
      <span
        aria-hidden="true"
        className="absolute right-[6%] bottom-[22%] text-lg text-blue-500/60"
      >
        ●
      </span>

      <Card className="w-full border-emerald-200 bg-linear-to-br from-card to-emerald-50/70 shadow-lg shadow-emerald-950/5 dark:border-emerald-900/70 dark:to-emerald-950/30">
        <CardContent className="flex flex-col items-center gap-5 px-7 py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-emerald-700 text-white ring-8 ring-emerald-100 dark:bg-emerald-300 dark:text-emerald-950 dark:ring-emerald-950/70">
            <Check className="size-8" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div>
            <p className="mb-2 font-medium text-emerald-700 dark:text-emerald-300">
              {sv.session.reflectionCompleteLabel}
            </p>
            <h1 className="font-heading text-2xl leading-snug font-medium">
              {sv.session.reflectionSuccess}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {sv.session.reflectionCompleteIntro}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-emerald-100/80 px-4 py-3 text-sm dark:bg-emerald-950/70">
            <Sparkles className="size-4" aria-hidden="true" />
            {sv.session.reflectionCompleteThanks}
          </div>
          <Link
            href="/"
            className={cn(buttonVariants({ size: "lg" }), "h-11 w-full")}
          >
            {sv.session.reflectionCompleteHome}
          </Link>
          <p className="text-xs text-muted-foreground">
            {sv.session.reflectionCompleteClose}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
