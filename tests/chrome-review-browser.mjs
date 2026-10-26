import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ['--disable-gpu', '--mute-audio'] });
const dir = await testOutput(import.meta.url);
await mkdir(dir, { recursive: true });
const report = { checks: [], layouts: [], errors: [] };
const check = (condition, message) => { assert.ok(condition, message); report.checks.push(message); };
const ready = async page => { await page.locator('html:not([data-starting])').waitFor(); await page.evaluate(() => document.fonts.ready); };
const file = name => artifactPath(name, dir);
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 465, height: 764 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(theme => {
      localStorage.setItem('nextround-theme', theme);
      const observe = new MutationObserver(() => {
        if (window.__firstLamp) return;
        const lamp = document.querySelector('.portal .site-controls [data-action="toggle-theme"]');
        if (!lamp) return;
        window.__firstLamp = { artwork: lamp.querySelector('svg').innerHTML, pressed: lamp.getAttribute('aria-pressed'), label: lamp.getAttribute('aria-label'), theme: document.body.className };
        observe.disconnect();
      });
      observe.observe(document, { childList: true, subtree: true });
    }, theme);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(new URL('', baseUrl).href); await ready(page);
    const initial = await page.evaluate(() => window.__firstLamp);
    check(initial && initial.theme.includes(`theme-${theme}`) && initial.pressed === String(theme === 'light'), `${theme}: first inserted lamp uses the saved world and matching aria state`);
    check(theme === 'light' ? initial.artwork.includes('<circle') && !initial.artwork.includes('A8.5') : !initial.artwork.includes('<circle') && initial.artwork.includes('M20.5 14.2A8.5'), `${theme}: first rendered shape is the correct sun or crescent`);
    const lamp = page.locator('.portal [data-action="toggle-theme"]');
    await lamp.click(); await lamp.click();
    const cycled = await lamp.locator('svg').innerHTML();
    check(cycled === initial.artwork && await lamp.getAttribute('aria-pressed') === initial.pressed, `${theme}: a full theme roundtrip has identical SVG geometry and state`);
    check(await page.locator('.site-controls').evaluate(e => e.firstElementChild.matches('[data-action="toggle-theme"]')), `${theme}: the lamp remains the leftmost homepage control`);
    await page.screenshot({ path: file(`first-${theme}-465.png`) });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 764 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage(); page.on('pageerror', error => report.errors.push(error.message));
  const measure = () => page.evaluate(() => {
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }; };
    const rows = [...document.querySelectorAll('.side-utilities>*')];
    return { width: innerWidth, height: innerHeight, rows: rows.map(element => ({ ...box(element), target: element.dataset.action || (element.hasAttribute('data-corner-share') ? 'share' : element.getAttribute('href')), reachable: document.elementFromPoint(element.getBoundingClientRect().x + element.getBoundingClientRect().width / 2, element.getBoundingClientRect().y + element.getBoundingClientRect().height / 2)?.closest('.side-utilities>*') === element })), footer: box(document.querySelector('.side-local')), rail: box(document.querySelector('.sidebar')), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  for (const [width, height] of [[320, 764], [390, 764], [507, 764], [1440, 900], [1440, 764]]) {
    await page.setViewportSize({ width, height });
    await page.route('**/chrome-review.css*', route => route.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto(`${baseUrl}?chrome-check=${width}-${height}#/dashboard`); await ready(page);
    const before = await measure();
    await page.unroute('**/chrome-review.css*'); await page.reload(); await ready(page);
    check(await page.locator('link[href*="chrome-review.css"]').count() === 1, `${width}×${height}: the actual review stylesheet is loaded`);
    const after = await measure();
    check(after.rows[0].y - before.rows[0].y >= (width <= 780 ? 35 : 17), `${width}×${height}: the complete utility group is visibly lower`);
    check(after.rows.every((row, i) => Math.abs(row.x - before.rows[i].x) < .1 && row.height >= 44), `${width}×${height}: the common icon column and 44px targets are preserved`);
    check(after.rows.every(row => row.reachable && row.y >= 0 && row.bottom <= height) && after.footer.bottom + 5 <= after.rows[0].y && after.footer.bottom <= height && !after.overflow, `${width}×${height}: all actions remain reachable below the unoccluded local-space note`);
    if (width <= 780) {
      await page.locator('[data-action="expand-brand-nav"]').click();
      const expanded = await measure();
      check(expanded.rows.every((row, i) => Math.abs(row.y - after.rows[i].y) < .1 && Math.abs(row.x - after.rows[i].x) < .1), `${width}×${height}: expanding navigation preserves utility coordinates`);
      await page.screenshot({ path: file(`rail-expanded-${width}.png`) });
      report.layouts.push({ before, after, expanded });
    } else report.layouts.push({ before, after });
    await page.screenshot({ path: file(`rail-${width}-${height}.png`) });
  }
  await context.close();
  assert.deepEqual(report.errors, []);
  await writeFile(new URL('VERIFICATION.json', dir), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
