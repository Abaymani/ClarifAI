import { expect, test } from "@playwright/test";

import { seedCompletedSession, seedParticipant } from "./seed";

async function logIn(
  page: import("@playwright/test").Page,
  code: string,
  pin: string,
  lesson: number,
): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Deltagarkod").fill(code);
  await page.getByLabel("PIN-kod").fill(pin);
  await page.getByText(`Lektion ${lesson}`, { exact: true }).click();
  await page.getByRole("button", { name: "Starta" }).click();
}

test("starts a session with the right code and PIN", async ({ page }) => {
  await seedParticipant("901", "4321");

  await logIn(page, "901", "4321", 2);

  await expect(
    page.getByRole("heading", { name: "Sessionen är igång" }),
  ).toBeVisible();
  await expect(page.getByText("Deltagare 901 · Lektion 2")).toBeVisible();
  // The transcript step belongs to S1 and must not accept anything yet.
  await expect(page.getByLabel("Länk till din Gemini-chatt")).toBeDisabled();
});

test("keeps the student out with a wrong PIN and counts the attempt", async ({
  page,
}) => {
  await seedParticipant("902", "4321");

  await logIn(page, "902", "0000", 1);

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod. Du har 2 försök kvar.",
  );
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Tala med din lärare",
  );
});

test("explains that an unknown code does not exist", async ({ page }) => {
  await logIn(page, "999", "4321", 1);

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Koden finns inte",
  );
});

test("will not reopen a lesson that is already handed in", async ({ page }) => {
  await seedParticipant("903", "4321");
  await seedCompletedSession("903", 1);

  await logIn(page, "903", "4321", 1);

  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Lektion 1 är redan inlämnad",
  );
});

test("resumes the session after a reload and logs out again", async ({
  page,
}) => {
  await seedParticipant("904", "4321");

  await logIn(page, "904", "4321", 3);
  await expect(
    page.getByRole("heading", { name: "Sessionen är igång" }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("Deltagare 904 · Lektion 3")).toBeVisible();

  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});

test("sends visitors without a session back to the login page", async ({
  page,
}) => {
  await page.goto("/session");

  await expect(page.getByRole("heading", { name: "Logga in" })).toBeVisible();
});

test("keeps what the student typed after a failed attempt", async ({
  page,
}) => {
  await seedParticipant("905", "4321");

  await logIn(page, "905", "0000", 2);
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod",
  );

  // Only the PIN should need correcting; the code and lesson must survive.
  await expect(page.getByLabel("Deltagarkod")).toHaveValue("905");
  await expect(page.getByRole("radio", { name: "Lektion 2" })).toBeChecked();
  // The value that is actually submitted, not just what the radio looks like.
  await expect(page.locator('input[name="lesson"]')).toHaveValue("2");

  await page.getByLabel("PIN-kod").fill("4321");
  await page.getByRole("button", { name: "Starta" }).click();
  await expect(
    page.getByRole("heading", { name: "Sessionen är igång" }),
  ).toBeVisible();
});

test("can retry straight after a wrong PIN without touching the form", async ({
  page,
}) => {
  await seedParticipant("906", "4321");

  await logIn(page, "906", "0000", 2);
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod",
  );

  // Pressing the button again must complain about the PIN, not the lesson.
  await page.getByRole("button", { name: "Starta" }).click();
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "Fel PIN-kod",
  );
});
