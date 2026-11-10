import type { Lesson } from "@/lib/session/credentials";

// Lessons 2 and 3 are the ones that analyse the chat and ask reflection questions;
// the analysis itself is the same for every lesson.
export const DEMO_LESSON: Lesson = 2;

// The expo demo (DL-079) has no login, so it refuses to run anywhere but against
// the local emulator's demo project, which can never reach the study's database.
export function demoMode(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  if (env.CLARIFAI_DEMO !== "1") return false;
  if (
    !env.FIRESTORE_EMULATOR_HOST?.trim() ||
    env.GCLOUD_PROJECT?.trim() !== "demo-clarifai"
  ) {
    throw new Error(
      "CLARIFAI_DEMO=1 needs the Firestore emulator and the project demo-clarifai",
    );
  }
  return true;
}
