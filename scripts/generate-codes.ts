// Creates participant codes with a PIN each (DL-029) and writes the list the teacher
// hands out. The CSV pairs codes with PINs, so it goes in the git-ignored folder.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { generatePin } from "@/lib/session/credentials";
import { ensureParticipants } from "@/lib/session/store";

const OUTPUT_FILE = path.join("private-data", "participant-codes.csv");
const DEFAULT_COUNT = 64;

async function main(argument: string | undefined): Promise<number> {
  const count = Number(argument ?? DEFAULT_COUNT);
  if (!Number.isInteger(count) || count < 1 || count > 999) {
    console.error("Usage: pnpm codes:generate [count]   (1-999, default 64)");
    return 2;
  }

  const target = process.env.FIRESTORE_EMULATOR_HOST
    ? `the local emulator (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `project ${process.env.FIREBASE_PROJECT_ID ?? "(no FIREBASE_PROJECT_ID set)"}`;
  console.log(`Writing codes 1-${count} to ${target}`);

  const entries = Array.from({ length: count }, (_, index) => ({
    code: String(index + 1),
    pin: generatePin(),
  }));
  const participants = await ensureParticipants(entries);

  const rows = participants.map(({ code, pin }) => `${code},${pin}`);
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `participant_code,pin\n${rows.join("\n")}\n`);

  const created = participants.filter((entry) => entry.created).length;
  console.log(
    [
      `${created} new code${created === 1 ? "" : "s"}, ${participants.length - created} already existed (their PINs are unchanged).`,
      `Hand-out list: ${OUTPUT_FILE} — keep it out of git and off shared drives.`,
    ].join("\n"),
  );
  return 0;
}

main(process.argv[2]).then((code) => {
  process.exitCode = code;
});
