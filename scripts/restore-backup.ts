// Loads a backup made by `pnpm db:backup` into the Firestore emulator, then reads
// everything back and checks it against the backup (DL-067). It never writes to a
// real project.
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  DOCUMENTS_FILE,
  MANIFEST_FILE,
  parseNdjson,
  readAllDocuments,
  sha256,
  toNdjson,
  writeDocuments,
  type BackupManifest,
} from "@/lib/backup/firestore-backup";
import { getDb } from "@/lib/firebase/admin";

const USAGE =
  "Usage: FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 pnpm db:restore private-data/backups/<folder>";

async function main(folder: string | undefined): Promise<number> {
  if (!folder) {
    console.error(USAGE);
    return 2;
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      `A backup can only be restored into the Firestore emulator. Start one (for example with pnpm dev), then run:\n${USAGE}`,
    );
    return 2;
  }

  const manifest = JSON.parse(
    await readFile(path.join(folder, MANIFEST_FILE), "utf8"),
  ) as BackupManifest;
  if (
    manifest.format !== BACKUP_FORMAT ||
    manifest.formatVersion !== BACKUP_FORMAT_VERSION ||
    manifest.file !== DOCUMENTS_FILE
  ) {
    console.error(`${folder} does not hold a backup this version can read.`);
    return 2;
  }
  const text = await readFile(path.join(folder, DOCUMENTS_FILE), "utf8");
  if (sha256(text) !== manifest.sha256) {
    console.error(
      "The backup file has changed since it was made: its checksum no longer matches.",
    );
    return 1;
  }
  const documents = parseNdjson(text);

  const db = getDb();
  // An empty emulator, so afterwards it can be compared with the backup as a whole.
  if ((await db.listCollections()).length > 0) {
    console.error(
      "The emulator already holds data. Restart it empty (stop and start pnpm dev), then restore.",
    );
    return 2;
  }

  console.log(
    `Writing ${documents.length} documents from the ${manifest.projectId} backup of ${manifest.startedAt} into the emulator …`,
  );
  await writeDocuments(db, documents);

  if (sha256(toNdjson(await readAllDocuments(db))) !== manifest.sha256) {
    console.error("The emulator does not hold the same data as the backup.");
    return 1;
  }
  console.log(
    [
      `Verified: the emulator holds exactly the ${documents.length} documents of the backup.`,
      "Browse them in the emulator UI at http://localhost:4000/firestore.",
    ].join("\n"),
  );
  return 0;
}

main(process.argv[2]).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
