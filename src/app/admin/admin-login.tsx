"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getApps, initializeApp } from "firebase/app";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { FirebaseWebAuthConfig } from "@/lib/admin/auth";

const APP_NAME = "clarifai-researcher-auth";
let emulatorConnected = false;

export function AdminLogin({
  config,
}: {
  config: FirebaseWebAuthConfig | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    if (!config) return;
    setPending(true);
    setError(null);

    const app =
      getApps().find((candidate) => candidate.name === APP_NAME) ??
      initializeApp(
        {
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
        },
        APP_NAME,
      );
    const auth = getAuth(app);
    if (config.emulatorUrl && !emulatorConnected) {
      connectAuthEmulator(auth, config.emulatorUrl, { disableWarnings: true });
      emulatorConnected = true;
    }

    try {
      await setPersistence(auth, inMemoryPersistence);
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      const response = await fetch("/admin/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Inloggningen kunde inte slutföras.");
        return;
      }
      await signOut(auth);
      router.push("/admin/overview");
      router.refresh();
    } catch {
      setError("Inloggningen avbröts eller kunde inte slutföras.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {!config ? (
        <Alert variant="destructive">
          <AlertDescription>
            Forskarinloggningen är inte konfigurerad.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={!config || pending}
        onClick={login}
        className="h-11"
      >
        <span aria-hidden="true" className="font-semibold">
          G
        </span>
        {pending ? "Loggar in…" : "Fortsätt med Google"}
      </Button>
      <p className="border-t pt-4 text-center text-sm text-muted-foreground">
        Endast behöriga forskare har åtkomst.
      </p>
    </div>
  );
}
