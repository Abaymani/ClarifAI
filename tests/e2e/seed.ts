// Test data for the end-to-end run. The suite runs inside `firebase emulators:exec`,
// so this talks to the emulator, never to a real project.
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "End-to-end tests must run against the emulator: use `pnpm test:e2e`.",
  );
}
process.env.METADATA_SERVER_DETECTION ??= "none";

const app =
  getApps()[0] ??
  initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-clarifai" });
const db = getFirestore(app);

export async function seedParticipant(
  code: string,
  pin: string,
): Promise<void> {
  await db
    .collection("participants")
    .doc(code)
    .set({ code, pin, failedAttempts: 0, lockedUntil: null });
}

export async function seedCompletedSession(
  code: string,
  lesson: number,
): Promise<void> {
  await db.collection("sessions").doc(`${code}_${lesson}`).set({
    participantCode: code,
    lesson,
    status: "completed",
    sessionTokenHash: "not-a-real-token",
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: new Date(),
    errorCode: null,
  });
}
