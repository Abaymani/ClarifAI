import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, test } from "vitest";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-clarifai",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("Firestore security rules", () => {
  test("anonymous browsers can neither read nor write", async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "sessions/any")));
    await assertFails(setDoc(doc(db, "sessions/any"), { lesson: 1 }));
  });

  test("signed-in browsers can neither read nor write", async () => {
    const db = testEnv.authenticatedContext("someone").firestore();
    await assertFails(getDoc(doc(db, "sessions/any")));
    await assertFails(setDoc(doc(db, "sessions/any"), { lesson: 1 }));
  });
});
