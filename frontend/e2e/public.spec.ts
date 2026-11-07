import { test, expect } from "@playwright/test";
test("landing and reporting are accessible on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every second/ }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Report an emergency", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tell us what happened." }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Submit emergency report" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("public reporting persists across a page reload", async ({ page }) => {
  test.skip(
    !process.env.TERA_E2E_URL,
    "Requires an isolated backend, PostgreSQL, Redis and SMTP deployment",
  );
  await page.goto("/report");
  await page
    .getByLabel("What is happening?")
    .fill("Isolated Playwright acceptance test report");
  await page
    .getByLabel("Address or nearby landmark")
    .fill("Browser test fixture location");
  await page.getByRole("button", { name: "Submit emergency report" }).click();
  await expect(page).toHaveURL(/\/track\/TRK-/);
  const url = page.url();
  await expect(page.getByText("incident · reported")).toBeVisible();
  await page.reload();
  await expect(page.getByText("incident · reported")).toBeVisible();
  expect(page.url()).toBe(url);
});
