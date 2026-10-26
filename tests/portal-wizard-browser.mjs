import { chromium, baseUrl, testOutput, artifactPath } from "./browser-support.mjs";
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXTROUND_BROWSER, args: ['--disable-gpu', '--mute-audio'] });
const dir = await testOutput(import.meta.url); await mkdir(dir, { recursive: true });
const file = name => artifactPath(name, dir);
const report = { checks: [], states: [], errors: [], realPhoneVerified: false, delivery: 'Actual localhost module, DOM, images and styles; no route bridge' };
const check = (condition, label) => { assert.ok(condition, label); report.checks.push(label); };
const measure = page => page.evaluate(() => {
  const root = document.querySelector('.portal');
  const box = selector => { const e = document.querySelector(selector), r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, z: getComputedStyle(e).zIndex, group: e.closest('.scene-subject') === root.querySelector('.scene-subject') }; };
  return { motion: root.dataset.portalMotion, theme: document.body.className, x: parseFloat(root.style.getPropertyValue('--portal-pointer-x')), y: parseFloat(root.style.getPropertyValue('--portal-pointer-y')), items: { wizard: box('.scene-wizard'), angel: box('.scene-angel.scene-statue'), demon: box('.scene-demon.scene-statue'), portalLeft: box('.portal-arc-left'), portalRight: box('.portal-arc-right'), halo: box('.head-halo') } };
});
const neutral = async page => { await page.locator('.portal').dispatchEvent('pointerleave'); await page.waitForFunction(() => { const p = document.querySelector('.portal'); return Math.abs(parseFloat(p.style.getPropertyValue('--portal-pointer-x'))) < .0006 && Math.abs(parseFloat(p.style.getPropertyValue('--portal-pointer-y'))) < .0006; }); };
const deltas = (before, after) => Object.fromEntries(Object.entries(before.items).map(([name, value]) => [name, { x: after.items[name].x - value.x, y: after.items[name].y - value.y }]));
const shared = motion => Object.values(motion).every(d => Math.abs(d.x - motion.wizard.x) < .1 && Math.abs(d.y - motion.wizard.y) < .1);
const returned = motion => Object.values(motion).every(d => Math.abs(d.x) < .1 && Math.abs(d.y) < .1);
const orient = (page, beta, gamma) => page.evaluate(([beta, gamma]) => window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma })), [beta, gamma]);
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  const page = await desktop.newPage(); page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(new URL('', baseUrl).href); await page.locator('html:not([data-starting])').waitFor(); await page.locator('.scene-wizard').evaluate(e => e.decode());
  for (const theme of ['dark', 'light']) {
    if (!(await page.locator(`body.theme-${theme}`).count())) await page.locator('.portal [data-action="toggle-theme"]').click();
    if (await page.evaluate(() => document.documentElement.dataset.motion === 'off')) await page.locator('[data-corner-motion]').click();
    await neutral(page); const before = await measure(page);
    check(Object.values(before.items).every(item => item.group), `${theme}: independent wizard, both statues, portal halves and halo share the same depth parent`);
    await page.mouse.move(1260, 440); await page.waitForFunction(() => parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x')) > .7);
    const moved = await measure(page), motion = deltas(before, moved);
    check(shared(motion) && Math.abs(motion.wizard.x) > 5, `${theme}: actual mouse displacement is identical for wizard, statues, portal and halo`);
    await page.screenshot({ path: file(`wizard-pointer-${theme}.png`) });
    await page.locator('[data-corner-motion]').click(); await page.waitForFunction(() => document.querySelector('.portal').dataset.portalMotion === 'off');
    const reset = await measure(page);
    check(returned(deltas(before, reset)), `${theme}: disabling motion returns the complete registered group to its original coordinates`);
    report.states.push({ input: 'pointer', theme, before, moved, motion, reset });
  }
  await desktop.close();
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await phone.addInitScript(() => { window.DeviceOrientationEvent = class extends Event {}; });
  const mobile = await phone.newPage(); mobile.on('pageerror', e => report.errors.push(e.message));
  await mobile.goto(new URL('', baseUrl).href); await mobile.locator('html:not([data-starting])').waitFor(); await mobile.locator('.scene-wizard').evaluate(e => e.decode());
  await mobile.waitForFunction(() => document.querySelector('.portal').dataset.gravityState === 'listening');
  await orient(mobile, 45, 3); const before = await measure(mobile);
  await orient(mobile, 54, 12); await mobile.waitForFunction(() => parseFloat(document.querySelector('.portal').style.getPropertyValue('--portal-pointer-x')) > .9);
  const moved = await measure(mobile), motion = deltas(before, moved);
  check(shared(motion) && Math.abs(motion.wizard.x) > 6 && Math.abs(motion.wizard.y) > 3, 'Simulated phone gravity moves the independent wizard, statues, portal halves and halo by exactly the same screen displacement');
  await mobile.screenshot({ path: file('wizard-gravity-mobile.png') });
  await mobile.locator('[data-corner-motion]').click(); await mobile.waitForFunction(() => document.querySelector('.portal').dataset.portalMotion === 'off');
  await orient(mobile, 65, 20); const reset = await measure(mobile);
  check(returned(deltas(before, reset)) && Math.abs(reset.x) < .0006 && Math.abs(reset.y) < .0006, 'Motion off resets the full group and ignores subsequent sensor input');
  check(moved.items.portalLeft.z === '1' && moved.items.wizard.z === '3' && moved.items.portalRight.z === '6', 'The wizard retains its intended layer between the rear and front portal halves');
  report.states.push({ input: 'simulated gravity', before, moved, motion, reset });
  await phone.close();
  assert.deepEqual(report.errors, []); await writeFile(new URL('WIZARD-VERIFICATION.json', dir), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }
