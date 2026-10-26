import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ['--disable-gpu', '--mute-audio'] });
const dir = await testOutput(import.meta.url);
await mkdir(dir, { recursive: true });
const report = { checks: [], errors: [], realPhoneVerified: false, delivery: 'Actual localhost module and styles, no route bridge', sourceReference: 'CreativeFolio/site/scene-v5.js and spatial-camera.js' };
const check = (condition, message) => { assert.ok(condition, message); report.checks.push(message); };
async function setup(options = {}, permission = null) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block', ...options });
  if (permission) await context.addInitScript((result) => {
    window.__permissionRequests = 0; window.__permissionResult = result; window.__screenAngle = 0;
    window.DeviceOrientationEvent = class extends Event { static async requestPermission() { window.__permissionRequests++; return window.__permissionResult; } };
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, get: () => window.__screenAngle });
  }, permission);
  else if (options.isMobile) await context.addInitScript(() => {
    window.DeviceOrientationEvent = class extends Event {};
    window.__screenAngle = 0;
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, get: () => window.__screenAngle });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.goto(new URL('', baseUrl).href);
  await page.locator('html:not([data-starting])').waitFor();
  await page.locator('.portal[data-portal-motion]').waitFor();
  return { page, context };
}
const value = (page) => page.evaluate(() => {
  const root = document.querySelector('.portal-crafted');
  return root && { state: root.dataset.portalMotion, gravity: root.dataset.gravityState, x: parseFloat(root.style.getPropertyValue('--portal-pointer-x')), y: parseFloat(root.style.getPropertyValue('--portal-pointer-y')), layers: [...root.querySelectorAll('.scene-environment,.scene-subject,.portal-intro,.entrance')].map(element => ({ selector: element.className, x: parseFloat(element.style.getPropertyValue('--portal-drift-x')), y: parseFloat(element.style.getPropertyValue('--portal-drift-y')), transform: getComputedStyle(element).transform, translate: getComputedStyle(element).translate, left: element.getBoundingClientRect().left })) };
});
const orient = (page, beta, gamma) => page.evaluate(([beta, gamma]) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma })), [beta, gamma]);
try {
  const { page, context } = await setup();
  const initial = await value(page);
  await page.screenshot({path:artifactPath('desktop-neutral.png', dir)});
  await page.mouse.move(1150, 700);
  await page.waitForFunction(() => parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x')) > .7);
  const moved = await value(page);
  const environment = moved.layers.find(layer => layer.selector === 'scene-environment');
  const subject = moved.layers.find(layer => layer.selector === 'scene-subject');
  const originalSubject = initial.layers.find(layer => layer.selector === 'scene-subject');
  check(subject.translate !== 'none' && Math.abs(subject.left - originalSubject.left - subject.x) < .1, 'The actual rendered statue/portal layer moves by the intended CSS translate without losing registration');
  await page.screenshot({path:artifactPath('desktop-pointer.png', dir)});
  check(Math.abs(subject.x / environment.x - 2.5) < .02, 'Mouse moves the registered statue/portal/halo group with more depth than the environment');
  check(moved.layers.every(layer => Math.abs(layer.x) > 0), 'Brand text and both entrance cards respond with independent depth travel');
  check(moved.layers.every((layer, i) => layer.transform === initial.layers[i].transform), 'Pointer response preserves all pre-existing registration transforms');
  await page.locator('.portal').dispatchEvent('pointerleave');
  await page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x'))) < .0006);
  check((await value(page)).layers.every(layer => Math.abs(layer.x) < .01 && Math.abs(layer.y) < .01), 'Pointer exit smoothly returns every layer to its original layout');
  await page.mouse.move(100, 160);
  await page.locator('[data-corner-motion]').click();
  await page.waitForFunction(() => document.querySelector('.portal').dataset.portalMotion === 'off');
  check((await value(page)).layers.every(layer => Math.abs(layer.x) < .01 && Math.abs(layer.y) < .01), 'Motion off cancels the frame and zeros all depth offsets');
  await page.locator('[data-corner-motion]').click();
  await page.waitForFunction(() => document.querySelector('.portal').dataset.portalMotion === 'on');
  await page.evaluate(() => { window.__oldPortal = document.querySelector('.portal'); location.hash = '/dashboard'; });
  await page.locator('.shell').waitFor();
  check(await page.evaluate(() => window.__oldPortal.style.getPropertyValue('--portal-pointer-x') === '' && [...window.__oldPortal.querySelectorAll('.scene-subject,.portal-intro,.entrance')].every(e => !e.style.getPropertyValue('--portal-drift-x'))), 'Leaving home releases its handlers and removes all motion offsets');
  await context.close();

  const mobile = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.page.waitForFunction(() => document.querySelector('.portal').dataset.gravityState === 'listening');
  await orient(mobile.page, 45, 5);
  check(Math.abs((await value(mobile.page)).x) < .001, 'The first phone sample calibrates the current holding pose without jumping');
  await orient(mobile.page, 54, 14);
  await mobile.page.waitForFunction(() => parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x')) > .9);
  await mobile.page.screenshot({path:artifactPath('mobile-gravity.png', dir)});
  check((await value(mobile.page)).layers.every(layer => Number.isFinite(layer.x) && Math.abs(layer.x) <= 8.501), 'Simulated gravity moves distinct layers within the smaller phone travel budget');
  await mobile.page.evaluate(() => { window.__screenAngle = 90; });
  await orient(mobile.page, 54, 14);
  await mobile.page.waitForFunction(() => Math.abs(parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x'))) < .0006);
  await orient(mobile.page, 63, 14);
  await mobile.page.waitForFunction(() => parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x')) > .9);
  check(Math.abs((await value(mobile.page)).y) < .001, 'Landscape rotation recalibrates neutral and correctly remaps the sensor axes');
  await mobile.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  check((await value(mobile.page)).state === 'off' && (await value(mobile.page)).layers.every(layer => Math.abs(layer.x) < .01), 'Page hiding freezes motion and clears the sensor pose');
  await mobile.page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await mobile.page.waitForFunction(() => document.querySelector('.portal').dataset.portalMotion === 'on');
  check((await value(mobile.page)).gravity === 'listening', 'Returning to a visible page reattaches the sensor for a fresh neutral sample');
  await mobile.context.close();

  for (const outcome of ['granted', 'denied']) {
    const phone = await setup({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, outcome);
    check(await phone.page.evaluate(() => window.__permissionRequests === 0), `${outcome}: sensor permission is never requested on page load`);
    await phone.page.locator('[data-corner-motion]').click();
    await phone.page.locator('[data-corner-motion]').click();
    await phone.page.waitForFunction(() => window.__permissionRequests === 1);
    check(await phone.page.evaluate(() => window.__permissionRequests === 1), `${outcome}: one explicit motion-enable click requests access once`);
    await phone.page.waitForFunction((outcome) => document.querySelector('.portal').dataset.gravityState === (outcome === 'granted' ? 'listening' : 'denied'), outcome);
    check((await value(phone.page)).state === 'on', `${outcome}: the page remains usable when the sensor decision returns`);
    await phone.context.close();
  }
  const reduced = await setup({ reducedMotion: 'reduce' });
  await reduced.page.evaluate(() => { document.documentElement.dataset.motion = 'on'; });
  await reduced.page.mouse.move(1100, 700);
  check((await value(reduced.page)).state === 'off' && (await value(reduced.page)).layers.every(layer => Math.abs(layer.x) < .01), 'System reduced-motion stays neutral even if the environment toggle is enabled');
  await reduced.context.close();
  assert.deepEqual(report.errors, []);
  await writeFile(new URL('VERIFICATION.json', dir), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
