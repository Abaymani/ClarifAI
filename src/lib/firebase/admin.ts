import "server-only";

import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { z } from "zod";

const serviceAccountEnv = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
});

// Initialised lazily so importing this module never needs credentials (e.g. during `next build`).
function getAdminApp(): App {
  if (getApps().length > 0) return getApp();

  // The emulator takes precedence so local runs can never write to the research database.
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // Stops Google's auth library from probing for a cloud metadata server that
    // doesn't exist locally (a slow timeout plus a warning on every run).
    process.env.METADATA_SERVER_DETECTION ??= "none";
    return initializeApp({
      projectId: process.env.GCLOUD_PROJECT ?? "demo-clarifai",
    });
  }

  const env = serviceAccountEnv.parse(process.env);
  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // Env files and the Vercel dashboard store the key's line breaks as literal "\n".
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

export function getDb(): Firestore {
  return getFirestore(getAdminApp());
}
