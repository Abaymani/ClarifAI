// Creates participant codes with a PIN each (DL-029) and writes the list the teacher
// hands out. The CSV pairs codes with PINs, so it goes in the git-ignored folder.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { generatePin } from "@/lib/session/credentials";
import { ensureParticipants } from "@/lib/session/store";

const DEFAULT_COUNT = 64;

async function main(argument: string | undefined): Promise<number> {
  const count = Number(argument ?? DEFAULT_COUNT);
  if (!Number.isInteger(count) || count < 1 || count > 999) {
    console.error("Usage: pnpm codes:generate [count]   (1-999, default 64)");
    return 2;
  }

  // The file is named after the database it belongs to, so preview PINs can never
  // be mistaken for the list handed out to students.
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const project = process.env.FIREBASE_PROJECT_ID ?? "unknown-project";
  const target = emulator ? "emulator" : project;
  const outputFile = path.join(
    "private-data",
    `participant-codes-${target.replace(/[^a-z0-9-]/gi, "-")}.csv`,
  );
  console.log(
    `Writing codes 1-${count} to ${emulator ? `the local emulator (${emulator})` : `project ${project}`}`,
  );

  const entries = Array.from({ length: count }, (_, index) => ({
    code: String(index + 1),
    pin: generatePin(),
  }));
  const participants = await ensureParticipants(entries);

  const rows = participants.map(({ code, pin }) => `${code},${pin}`);
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `participant_code,pin\n${rows.join("\n")}\n`);

  const created = participants.filter((entry) => entry.created).length;
  console.log(
    [
      `${created} new code${created === 1 ? "" : "s"}, ${participants.length - created} already existed (their PINs are unchanged).`,
      `Hand-out list: ${outputFile} — keep it out of git and off shared drives.`,
    ].join("\n"),
  );
  return 0;
}

main(process.argv[2]).then((code) => {
  process.exitCode = code;
});
