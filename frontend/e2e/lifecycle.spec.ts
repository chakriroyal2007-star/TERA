import { test, expect, Page, Browser } from "@playwright/test";
const password = "test-passphrase-123";
async function signIn(browser: Browser, role: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(role + "@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app(?:\/.*)?$/);
  return { page, context };
}
test("citizen → operator → responder → hospital → closure survives portal reloads", async ({
  browser,
  page,
}) => {
  test.skip(
    !process.env.TERA_E2E_URL,
    "Requires explicitly seeded isolated E2E database",
  );
  await page.goto("/report");
  await page
    .getByLabel("What is happening?")
    .fill("E2E lifecycle incident for isolated acceptance verification");
  await page
    .getByLabel("Address or nearby landmark")
    .fill("E2E lifecycle location");
  await page.getByRole("button", { name: "Submit emergency report" }).click();
  await page.locator('a[href^="/track/TRK-"]').click();
  await expect(page).toHaveURL(/\/track\/TRK-/);
  const tracking = page.url();
  const operator = await signIn(browser, "operator"),
    responder = await signIn(browser, "responder"),
    hospital = await signIn(browser, "hospital");
  try {
    const row = operator.page
      .getByRole("row")
      .filter({ hasText: "E2E lifecycle location" })
      .first();
    await row.getByRole("link", { name: /medical/ }).click();
    const incident = operator.page.url();
    await operator.page.getByLabel("Assessed priority").selectOption("high");
    await operator.page
      .getByLabel("Verification notes")
      .fill("E2E verified by control");
    await operator.page
      .getByRole("button", { name: "Verify incident" })
      .click();
    await operator.page
      .getByLabel("Available ambulance")
      .selectOption({ label: "E2E-001" });
    await operator.page
      .getByLabel("Available responder")
      .selectOption({ label: "E2E responder" });
    await operator.page.getByRole("button", { name: "Dispatch team" }).click();
    await responder.page.getByRole("link", { name: "Field missions" }).click();
    for (const next of ["acknowledged", "en route", "on scene"]) {
      await responder.page
        .getByRole("button", { name: "Confirm " + next, exact: true })
        .click();
      await expect(
        responder.page.getByRole("button", {
          name: "Confirm " + next,
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await operator.page.getByRole("button", { name: "Add Casualty" }).click();
    await operator.page.getByPlaceholder("Patient Name / Identifier (e.g. Casualty 2)").fill("E2E patient");
    await operator.page.getByRole("button", { name: "Save Casualty" }).click();
    await operator.page.getByRole("button", { name: /Assign Hospital/ }).first().click();
    await operator.page.getByText("E2E hospital", { exact: true }).click();
    await operator.page.getByRole("button", { name: "Submit Hospital Referral" }).click();
    await hospital.page.getByRole("link", { name: "Hospital network" }).click();
    await hospital.page.getByRole("button", { name: /Accept & Reserve Bed/ }).click();
    await hospital.page.getByRole("button", { name: /Incoming Referrals/ }).click();
    await expect(hospital.page.getByText("accepted", { exact: true })).toBeVisible();
    for (const next of ["transporting", "handover"]) {
      await responder.page
        .getByRole("button", { name: "Confirm " + next, exact: true })
        .click();
      await expect(
        responder.page.getByRole("button", {
          name: "Confirm " + next,
          exact: true,
        }),
      ).toHaveCount(0);
    }
    await hospital.page.getByRole("button", { name: /Patient Arrivals/ }).click();
    const arrival = hospital.page.locator('.referral-card-v2').filter({has: hospital.page.locator(`a[href="${new URL(incident).pathname}"]`)});
    await arrival.getByRole("button", { name: "Complete Bed Handover" }).click();
    await expect(arrival).toHaveCount(0);
    await responder.page
      .getByRole("button", { name: "Confirm completed", exact: true })
      .click();
    await expect(
      responder.page.locator("section.panel").filter({has: responder.page.locator(`a[href="${new URL(incident).pathname}"]`)}).getByText("completed", { exact: true }),
    ).toBeVisible();
    await operator.page.goto(incident);
    await operator.page
      .getByLabel("Closure summary")
      .fill("E2E hospital handover and mission completion confirmed");
    await operator.page.getByRole("button", { name: "Close incident" }).click();
    await expect(
      operator.page.getByText("closed", { exact: true }),
    ).toBeVisible();
    for (const p of [operator.page, responder.page, hospital.page]) {
      await p.reload();
      await expect(p.getByRole("alert")).toHaveCount(0);
    }
    await page.goto(tracking);
    await expect(page.getByText("closed", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("closed", { exact: true })).toBeVisible();
  } finally {
    await operator.context.close();
    await responder.context.close();
    await hospital.context.close();
  }
});
