import { test, expect } from "@playwright/test";
const pages: Record<string, string[]> = {
  admin: [
    "/app",
    "/app/missions",
    "/app/hospitals",
    "/app/analytics",
    "/app/resources",
    "/app/users",
    "/app/audit",
    "/app/system",
    "/app/account",
  ],
  operator: [
    "/app",
    "/app/missions",
    "/app/hospitals",
    "/app/analytics",
    "/app/account",
  ],
  responder: ["/app", "/app/missions", "/app/account"],
  hospital: ["/app", "/app/hospitals", "/app/account"],
  analyst: [
    "/app",
    "/app/missions",
    "/app/hospitals",
    "/app/analytics",
    "/app/account",
  ],
  citizen: ["/app", "/app/account"],
};
for (const [role, paths] of Object.entries(pages))
  test(`${role} portal loads authorized pages without API errors`, async ({
    page,
  }) => {
    test.skip(!process.env.TERA_E2E_URL, "Requires isolated E2E fixtures");
    const failures: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/api/") && r.status() >= 400)
        failures.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/login");
    await page.getByLabel("Email address").fill(role + "@example.com");
    await page
      .getByLabel("Password", { exact: true })
      .fill("test-passphrase-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    for (const path of paths) {
      await page.goto(path);
      await expect(
        page.getByRole("navigation", { name: "Workspace navigation" }),
      ).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("alert")).toHaveCount(0);
    }
    expect(failures).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
