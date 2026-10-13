// Reads every document of a Firestore database into the git-ignored private-data
// folder (DL-067). Firestore's own export needs a billing account. This only reads.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  DOCUMENTS_FILE,
  MANIFEST_FILE,
  collectionCounts,
  readAllDocuments,
  sha256,
  toNdjson,
  type BackupManifest,
} from "@/lib/backup/firestore-backup";
import { getDb } from "@/lib/firebase/admin";

const USAGE =
  "Usage: pnpm db:backup --project <project id> [--env <file with the service account key>]";

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { project: { type: "string" }, env: { type: "string" } },
  });
  if (!values.project) {
    console.error(USAGE);
    return 2;
  }
  // Variables already set in the shell win over the file; the project check below
  // catches a shell that points elsewhere.
  if (values.env) process.loadEnvFile(values.env);

  // The project named on the command line must be the one the key or the emulator
  // points at, so a backup never silently comes from the wrong database.
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const actual = emulator
    ? (process.env.GCLOUD_PROJECT ?? "demo-clarifai")
    : process.env.FIREBASE_PROJECT_ID;
  if (!actual) {
    console.error(
      "No key found. Pass --env with a file holding FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
    return 2;
  }
  if (actual !== values.project) {
    console.error(
      `The ${emulator ? "emulator" : "key"} points at "${actual}", not "${values.project}". Nothing was read.`,
    );
    return 2;
  }

  const startedAt = new Date();
  console.log(
    `Reading every document from ${emulator ? `the emulator (${emulator}), project ` : "project "}${actual} …`,
  );
  const documents = await readAllDocuments(getDb());
  const finishedAt = new Date();
  const text = toNdjson(documents);

  const folder = path.join(
    "private-data",
    "backups",
    `${actual}-${stamp(startedAt)}`,
  );
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    projectId: actual,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    documentCount: documents.length,
    collections: collectionCounts(documents),
    file: DOCUMENTS_FILE,
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text),
  };
  // "wx" never overwrites an earlier backup; only the owner can read the files.
  await writeFile(path.join(folder, DOCUMENTS_FILE), text, {
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(
    path.join(folder, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    {
      mode: 0o600,
      flag: "wx",
    },
  );

  // Read the file back now, so a short write is noticed while the data is still there.
  if (
    sha256(await readFile(path.join(folder, DOCUMENTS_FILE), "utf8")) !==
    manifest.sha256
  ) {
    console.error(
      "The written file does not match what was read. Run the backup again.",
    );
    return 1;
  }

  console.log(
    [
      `${documents.length} documents in ${((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)} s:`,
      ...Object.entries(manifest.collections).map(
        ([collection, count]) => `  ${collection}: ${count}`,
      ),
      `Saved to ${folder} (SHA-256 ${manifest.sha256.slice(0, 12)}…).`,
      "It holds every participant's PIN and all research data: keep it out of git and off shared drives,",
      "and encrypt any copy that leaves this computer. Delete the key file when you are done.",
    ].join("\n"),
  );
  return 0;
}

// 2026-10-09T14:25:30.123Z -> 20261009-142530 (UTC)
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
