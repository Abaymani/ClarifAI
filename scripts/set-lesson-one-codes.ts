// Saves which lesson 1 codes belong to which participants, as the one document the
// researcher portal reads (DL-072). It never reads or changes a session, and
// without --write it only shows what it would save.
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { FieldValue } from "firebase-admin/firestore";

import {
  LESSON_ONE_CODES_COLLECTION,
  LESSON_ONE_CODES_DOC,
  lessonOneCodesFromCsv,
  parseLessonOneCodes,
  type LessonOneCodesProblem,
} from "@/lib/admin/lesson-one-codes";
import { getDb } from "@/lib/firebase/admin";

const USAGE =
  "Usage: pnpm codes:lesson-one <csv file> --project <project id> [--env <file with the service account key>] [--write]";

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      project: { type: "string" },
      env: { type: "string" },
      write: { type: "boolean", default: false },
    },
  });
  const [file] = positionals;
  if (!file || positionals.length > 1 || !values.project) {
    console.error(USAGE);
    return 2;
  }
  if (values.env) process.loadEnvFile(values.env);

  // As in the backup: the project named on the command line must be the one the
  // key or the emulator points at.
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
      `The ${emulator ? "emulator" : "key"} points at "${actual}", not "${values.project}". Nothing was written.`,
    );
    return 2;
  }

  const parsed = parseLessonOneCodes(
    lessonOneCodesFromCsv(await readFile(file, "utf8")),
  );
  if (!parsed.ok) {
    console.error(`The mapping cannot be used: ${describe(parsed.problem)}.`);
    return 1;
  }

  const pairs = [...parsed.codes.toStudyCode];
  const unchanged = pairs
    .filter(([lessonOneCode, studyCode]) => lessonOneCode === studyCode)
    .map(([lessonOneCode]) => lessonOneCode);
  console.log(
    [
      `${pairs.length} lesson 1 codes, ${pairs.length - unchanged.length} of them changed${unchanged.length > 0 ? ` (unchanged: ${unchanged.join(", ")})` : ""}.`,
      `Target: ${LESSON_ONE_CODES_COLLECTION}/${LESSON_ONE_CODES_DOC} in ${emulator ? `the emulator (${emulator}), project ` : "project "}${actual}.`,
    ].join("\n"),
  );
  if (!values.write) {
    console.log("Nothing written. Run again with --write to save it.");
    return 0;
  }

  const ref = getDb()
    .collection(LESSON_ONE_CODES_COLLECTION)
    .doc(LESSON_ONE_CODES_DOC);
  const existed = (await ref.get()).exists;
  await ref.set({
    codes: Object.fromEntries(pairs),
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(existed ? "Saved, replacing the earlier mapping." : "Saved.");
  return 0;
}

function describe(problem: LessonOneCodesProblem): string {
  switch (problem.kind) {
    case "format":
      return "it is not a list of participant codes";
    case "duplicate":
      return `code ${problem.code} is given to two participants`;
    case "conflict":
      return `participant ${problem.code} already has a lesson 1 of their own`;
  }
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
