import { test, expect } from '@playwright/test';

test('a new citizen report reaches an already-open operator dashboard through WebSocket events', async ({ browser, page }) => {
  test.skip(!process.env.TERA_E2E_URL, 'Requires isolated E2E fixtures');
  const events: string[] = [];
  page.on('websocket', socket => socket.on('framereceived', frame => {
    try { events.push(JSON.parse(String(frame.payload)).kind); } catch { /* Ignore non-JSON frames. */ }
  }));
  await page.goto('/login');
  await page.getByLabel('Email address').fill('operator@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-passphrase-123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Updates connected', { exact: true })).toBeVisible();
  // Ensure replay has drained before watching the newly submitted event.
  await expect.poll(() => events.includes('heartbeat')).toBe(true);
  events.length = 0;
  const citizen = await browser.newContext();
  const report = await citizen.newPage();
  const location = 'Realtime browser audit ' + Date.now();
  try {
    await report.goto('/report');
    await report.getByLabel('What is happening?').fill('New report for real-time cross-dashboard verification');
    await report.getByLabel('Address or nearby landmark').fill(location);
    await report.getByRole('button', { name: 'Submit emergency report' }).click();
    await expect(report.locator('a[href^="/track/TRK-"]')).toBeVisible();
    await expect.poll(() => events.includes('incident.reported')).toBe(true);
    await expect(page.getByRole('row').filter({ hasText: location })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'test-results/audit-operator.png', fullPage: true });
  } finally { await citizen.close(); }
});
