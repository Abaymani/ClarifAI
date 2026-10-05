import { expect, test } from "@playwright/test";

test("researcher portal is only exposed at its direct URL", async ({
  page,
}) => {
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Forskarportal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fortsätt med Google" }),
  ).toBeVisible();
});

test("protected admin pages redirect unauthenticated visitors", async ({
  page,
}) => {
  await page.goto("/admin/overview");

  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Forskarportal" }),
  ).toBeVisible();
});
