"use client";

import { useActionState } from "react";

import { startDemoAction, type DemoState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { sv } from "@/lib/sv";

const EMPTY: DemoState = { error: null };

export function DemoStart() {
  const [state, formAction, pending] = useActionState(startDemoAction, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? sv.demo.starting : sv.demo.start}
      </Button>
    </form>
  );
}
