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

export async function getSessionData(code: string, lesson: number) {
  return (
    await db.collection("sessions").doc(`${code}_${lesson}`).get()
  ).data();
}

export async function seedParticipant(
  code: string,
  pin: string,
): Promise<void> {
  const batch = db.batch();
  batch.set(db.collection("participants").doc(code), {
    code,
    pin,
    failedAttempts: 0,
    lockedUntil: null,
  });
  for (const lesson of [1, 2, 3, 4]) {
    batch.delete(db.collection("sessions").doc(`${code}_${lesson}`));
  }
  await batch.commit();
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

function transcript(title: string) {
  return {
    source: {
      submittedLink: "https://gemini.google.com/share/abc123def456",
      shareUrl: "https://gemini.google.com/share/abc123def456",
      title,
      model: "Gemini",
      sharedAt: null,
    },
    retrievedAt: new Date().toISOString(),
    parserVersion: 2,
    messages: [
      {
        index: 1,
        role: "student",
        text: "Hur kopplar jag en lysdiod?",
      },
      {
        index: 2,
        role: "gemini",
        text: [
          "# Koppla lysdioden",
          "",
          "## Du behöver",
          "",
          "- En lysdiod",
          "- Ett `seriemotstånd`",
          "",
          "[PICTURE]",
          "",
          "Använd ett seriemotstånd och kontrollera polariteten.",
        ].join("\n"),
      },
    ],
    warnings: [],
  };
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
      transcript: transcript(title),
    });
}

// A confirmed lesson 2 or 3 session whose analysis failed.
export async function seedFailedAnalysis(
  code: string,
  lesson: number,
  errorCode: string,
): Promise<void> {
  await db
    .collection("sessions")
    .doc(`${code}_${lesson}`)
    .set({
      participantCode: code,
      lesson,
      status: "failed",
      sessionTokenHash: "replaced-at-login",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      errorCode,
      transcriptConfirmedAt: new Date(),
      analysisStartedAt: new Date(),
      transcript: transcript("Lysdiod och Arduino"),
    });
}
