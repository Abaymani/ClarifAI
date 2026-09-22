import { expect, test } from "vitest";

import { getDb } from "@/lib/firebase/admin";

test("the server reads and writes Firestore through the Admin SDK", async () => {
  const ref = getDb().collection("smoke-tests").doc("admin-sdk");
  await ref.set({ ok: true });

  const snapshot = await ref.get();
  expect(snapshot.data()).toEqual({ ok: true });
});
