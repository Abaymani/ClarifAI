"use client";

import { useEffect } from "react";

import { clearStoredDrafts } from "@/lib/session/reflection-drafts";

// The answers are saved on the server now, so the tab's copy has done its job.
export function ClearReflectionDrafts() {
  useEffect(() => {
    clearStoredDrafts();
  }, []);
  return null;
}
