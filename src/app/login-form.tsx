"use client";

import { useActionState, useState } from "react";

import { startSessionAction, type LoginState } from "@/app/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LESSONS } from "@/lib/session/credentials";
import { sv } from "@/lib/sv";

const EMPTY: LoginState = { error: null, field: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    startSessionAction,
    EMPTY,
  );
  // React clears an uncontrolled form once the action returns, which would throw
  // away the code and the chosen lesson after a wrong PIN.
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [lesson, setLesson] = useState("");

  const errorId = state.error ? "login-error" : undefined;
  const describedBy = (field: LoginState["field"]) =>
    state.field === field ? errorId : undefined;

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
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-invalid={state.field === "code"}
          aria-describedby={describedBy("code")}
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
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          aria-invalid={state.field === "pin"}
          aria-describedby={describedBy("pin")}
        />
        <p className="text-sm text-muted-foreground">{sv.login.pinHint}</p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">
          {sv.login.lessonLegend}
        </legend>
        <RadioGroup
          className="grid grid-cols-2 gap-3"
          value={lesson}
          onValueChange={(value) => setLesson(String(value ?? ""))}
          aria-invalid={state.field === "lesson"}
          aria-describedby={describedBy("lesson")}
        >
          {LESSONS.map((option) => (
            <Label
              key={option}
              htmlFor={`lesson-${option}`}
              className="flex h-11 items-center gap-3 rounded-lg border border-input px-3 font-normal"
            >
              <RadioGroupItem id={`lesson-${option}`} value={String(option)} />
              {sv.login.lesson(option)}
            </Label>
          ))}
        </RadioGroup>
        {/* The chosen lesson is submitted from React state: the radio group's own
            hidden input is cleared when React resets the form after an attempt. */}
        <input type="hidden" name="lesson" value={lesson} />
      </fieldset>

      {state.error ? (
        <Alert variant="destructive" role="alert" id={errorId}>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? sv.login.submitting : sv.login.submit}
      </Button>
    </form>
  );
}
