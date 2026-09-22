// Without the emulator these tests would fall through to real credentials, and so to
// the research database.
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    "Emulator tests must run against the Firestore emulator: use `pnpm test:emulator`.",
  );
}
