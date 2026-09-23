"use client";

import { useActionState } from "react";

import { startSessionAction, type LoginState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LESSONS } from "@/lib/session/credentials";
import { sv } from "@/lib/sv";

const EMPTY: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    startSessionAction,
    EMPTY,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{sv.login.code}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="off"
          placeholder={sv.login.codePlaceholder}
          className="h-11"
        />
        <p className="text-sm text-muted-foreground">{sv.login.codeHint}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">{sv.login.pin}</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder={sv.login.pinPlaceholder}
          className="h-11"
        />
        <p className="text-sm text-muted-foreground">{sv.login.pinHint}</p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">
          {sv.login.lessonLegend}
        </legend>
        <RadioGroup name="lesson" className="grid grid-cols-2 gap-3">
          {LESSONS.map((lesson) => (
            <Label
              key={lesson}
              htmlFor={`lesson-${lesson}`}
              className="flex h-11 items-center gap-3 rounded-lg border border-input px-3 font-normal"
            >
              <RadioGroupItem id={`lesson-${lesson}`} value={String(lesson)} />
              {sv.login.lesson(lesson)}
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      {state.error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? sv.login.submitting : sv.login.submit}
      </Button>

      <p className="text-sm text-muted-foreground">{sv.login.privacy}</p>
    </form>
  );
}
