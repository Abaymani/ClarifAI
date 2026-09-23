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

export async function seedTranscriptForConfirmation(
  code: string,
  lesson: number,
  title = "Lysdiod och Arduino",
): Promise<void> {
  await db
    .collection("sessions")
    .doc(`${code}_${lesson}`)
    .set({
      participantCode: code,
      lesson,
      status: "awaiting_confirmation",
      sessionTokenHash: "replaced-at-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      errorCode: null,
      transcriptConfirmedAt: null,
      transcript: {
        source: {
          submittedLink: "https://gemini.google.com/share/abc123def456",
          shareUrl: "https://gemini.google.com/share/abc123def456",
          title,
          model: "Gemini",
          sharedAt: null,
        },
        retrievedAt: new Date().toISOString(),
        parserVersion: 1,
        messages: [
          {
            index: 1,
            role: "student",
            text: "Hur kopplar jag en lysdiod?",
          },
          {
            index: 2,
            role: "gemini",
            text: "Använd ett seriemotstånd och kontrollera polariteten.",
          },
        ],
        warnings: [],
      },
    });
}
