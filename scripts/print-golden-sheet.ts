// Renders the real print page to PDF via headless Chromium so the backend can
// verify extraction against what the browser ACTUALLY prints — this catches
// CSS mm drift that the backend's synthetic (descriptor-driven) renderer is
// structurally blind to.
//
// Usage:
//   1. npm i -D playwright && npx playwright install chromium
//   2. dev server running on :3000, logged-in session cookie in GOLDEN_COOKIE
//      (format: "name=value")
//   3. npx tsx scripts/print-golden-sheet.ts <school-id> golden-sheet.pdf
//   4. Copy the PDF plus a golden-sheet.ctx.json sidecar
//      ({ roster, school_id, min_date, max_date }) into
//      opengradhub-backend/src/attendance/omr/test-fixtures/
import { chromium } from 'playwright';

const [schoolId, out] = process.argv.slice(2);
if (!schoolId || !out) {
  console.error('Usage: npx tsx scripts/print-golden-sheet.ts <school-id> <out.pdf>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
if (process.env.GOLDEN_COOKIE) {
  const [name, ...rest] = process.env.GOLDEN_COOKIE.split('=');
  await page.context().addCookies([{ name, value: rest.join('='), url: 'http://localhost:3000' }]);
}
await page.goto(`http://localhost:3000/print/register?school_id=${schoolId}`);
await page.waitForSelector('.sheet-page img[alt=""]'); // QR rendered = data loaded
await page.pdf({
  path: out,
  format: 'A4',
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
});
await browser.close();
console.log(`Wrote ${out}`);
