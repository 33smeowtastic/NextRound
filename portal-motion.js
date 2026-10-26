// A small 2D depth response, adapted from CreativeFolio's neutral-pose camera.
// Layer CSS consumes --portal-drift-x/y via the independent translate property,
// preserving each layer's existing registration transform and scroll geometry.
const clamp = (value, low = -1, high = 1) => Math.max(low, Math.min(high, value));
const angleDelta = (value) => ((value + 180) % 360 + 360) % 360 - 180;

export function normalizePortalTilt(sample, neutral, angle = 0) {
  if (!sample || !neutral || ![sample.gamma, sample.beta, neutral.gamma, neutral.beta, angle].every(Number.isFinite)) return { x: 0, y: 0 };
  const gamma = angleDelta(sample.gamma - neutral.gamma);
  const beta = angleDelta(sample.beta - neutral.beta);
  const radians = angle * Math.PI / 180;
  const axis = (value) => Math.abs(value) <= 1 ? 0 : Math.sign(value) * Math.min(1, (Math.abs(value) - 1) / 8);
  return {
    x: axis(gamma * Math.cos(radians) + beta * Math.sin(radians)),
    y: axis(beta * Math.cos(radians) - gamma * Math.sin(radians)),
  };
}

export function createPortalMotion({ doc = document, win = window } = {}) {
  const app = doc.querySelector('#app');
  if (!app) return { destroy() {} };
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = win.matchMedia('(pointer: coarse)');
  let portal = null, layers = [], frame = 0, lastTime = 0, active = false, pageActive = true;
  let current = { x: 0, y: 0 }, goal = { x: 0, y: 0 }, neutral = null;
  let gravityListening = false, permission = 'unknown', permissionPending = false;
  const removers = [];
  const listen = (target, type, listener, options) => {
    target?.addEventListener(type, listener, options);
    removers.push(() => target?.removeEventListener(type, listener, options));
  };
  const screenAngle = () => Number(win.screen?.orientation?.angle ?? win.orientation ?? 0) || 0;
  const available = () => Boolean(portal?.isConnected && pageActive && !doc.hidden && !reduced.matches && doc.documentElement.dataset.motion !== 'off' && !doc.documentElement.hasAttribute('data-starting'));
  const paint = () => {
    if (!portal) return;
    const strength = coarse.matches ? .85 : 1;
    portal.style.setProperty('--portal-pointer-x', current.x.toFixed(5));
    portal.style.setProperty('--portal-pointer-y', current.y.toFixed(5));
    for (const { element, x, y } of layers) {
      element.style.setProperty('--portal-drift-x', `${(-current.x * x * strength).toFixed(3)}px`);
      element.style.setProperty('--portal-drift-y', `${(-current.y * y * strength).toFixed(3)}px`);
    }
  };
  const stopFrame = () => { if (frame) win.cancelAnimationFrame(frame); frame = 0; lastTime = 0; };
  const zero = () => { stopFrame(); current = { x: 0, y: 0 }; goal = { x: 0, y: 0 }; neutral = null; paint(); };
  const tick = (time) => {
    frame = 0;
    if (!active || !available()) { sync(); return; }
    const mix = 1 - Math.exp(-Math.min(40, time - (lastTime || time - 16)) / 130);
    lastTime = time;
    let moving = false;
    for (const axis of ['x', 'y']) {
      const distance = goal[axis] - current[axis];
      if (Math.abs(distance) > .0005) { current[axis] += distance * mix; moving = true; }
      else current[axis] = goal[axis];
    }
    paint();
    if (moving) frame = win.requestAnimationFrame(tick);
    else lastTime = 0;
  };
  const point = (x, y) => {
    if (!active || !available()) return;
    goal = { x: clamp(x), y: clamp(y) };
    if (!frame) { lastTime = 0; frame = win.requestAnimationFrame(tick); }
  };
  const orientation = (event) => {
    if (!active || !available() || !Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    const angle = screenAngle();
    if (!neutral || neutral.angle !== angle) { neutral = { gamma: event.gamma, beta: event.beta, angle }; point(0, 0); }
    else { const tilt = normalizePortalTilt(event, neutral, angle); point(tilt.x, tilt.y); }
    if (portal) portal.dataset.gravityState = 'active';
  };
  const detachGravity = () => {
    if (gravityListening) win.removeEventListener('deviceorientation', orientation);
    gravityListening = false; neutral = null;
  };
  const attachGravity = () => {
    if (gravityListening || !active || !coarse.matches || !win.DeviceOrientationEvent) return;
    const needsPermission = typeof win.DeviceOrientationEvent.requestPermission === 'function';
    if (needsPermission && permission !== 'granted') {
      portal.dataset.gravityState = permission === 'denied' ? 'denied' : 'permission-required';
      return;
    }
    win.addEventListener('deviceorientation', orientation, { passive: true });
    gravityListening = true;
    portal.dataset.gravityState = 'listening';
  };
  function sync() {
    const next = available();
    if (next !== active) { active = next; zero(); }
    if (portal) portal.dataset.portalMotion = active ? 'on' : 'off';
    if (active) attachGravity();
    else detachGravity();
  }
  const pointer = (event) => {
    if (!active || event.pointerType === 'touch') return;
    const rect = portal.getBoundingClientRect();
    point((event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1, (event.clientY - rect.top) / Math.max(1, Math.min(rect.height, win.innerHeight)) * 2 - 1);
  };
  const leave = () => { if (active) point(0, 0); };
  const releasePortal = () => {
    active = false; zero(); detachGravity();
    if (portal) {
      portal.removeEventListener('pointermove', pointer);
      portal.removeEventListener('pointerleave', leave);
      for (const { element } of layers) {
        element.style.removeProperty('--portal-drift-x'); element.style.removeProperty('--portal-drift-y');
      }
      portal.style.removeProperty('--portal-pointer-x'); portal.style.removeProperty('--portal-pointer-y');
      delete portal.dataset.portalMotion; delete portal.dataset.gravityState;
    }
    portal = null; layers = [];
  };
  const mount = () => {
    const next = app.querySelector('.portal-crafted');
    if (next === portal) { sync(); return; }
    releasePortal();
    if (!next) return;
    portal = next;
    const add = (selector, x, y) => { const element = portal.querySelector(selector); if (element) layers.push({ element, x, y }); };
    add('.scene-environment', 4, 3);
    add('.scene-subject', 10, 6);
    add('.portal-intro', 5, 3);
    portal.querySelectorAll('.entrance').forEach((element, index) => layers.push({ element, x: 7 + Math.min(index, 1) * 2, y: 4 + Math.min(index, 1) }));
    portal.addEventListener('pointermove', pointer, { passive: true });
    portal.addEventListener('pointerleave', leave);
    zero(); sync();
  };
  const requestGravityFromGesture = async (event) => {
    // Capture sees the old switch state; a click from "off" is the explicit
    // enable gesture. Never ask for sensor access on page load or unrelated taps.
    if (!portal || !coarse.matches || reduced.matches || !event.target.closest?.('[data-corner-motion]') || doc.documentElement.dataset.motion !== 'off') return;
    const DeviceOrientation = win.DeviceOrientationEvent;
    if (!DeviceOrientation || permissionPending || permission === 'granted') return;
    if (typeof DeviceOrientation.requestPermission !== 'function') return;
    permissionPending = true;
    const requestedPortal = portal;
    try {
      const result = await DeviceOrientation.requestPermission();
      permission = result === 'granted' ? 'granted' : 'denied';
      if (portal === requestedPortal) { neutral = null; sync(); }
    } catch { permission = 'denied'; if (portal === requestedPortal) portal.dataset.gravityState = 'unavailable'; }
    finally { permissionPending = false; }
  };
  const resetForOrientation = () => { zero(); sync(); };
  const appObserver = new MutationObserver(mount);
  appObserver.observe(app, { childList: true });
  const stateObserver = new MutationObserver(sync);
  stateObserver.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-motion', 'data-starting'] });
  listen(doc, 'click', requestGravityFromGesture, true);
  listen(doc, 'visibilitychange', () => { zero(); sync(); });
  listen(win, 'blur', leave);
  listen(win, 'pagehide', () => { pageActive = false; zero(); sync(); });
  listen(win, 'pageshow', () => { pageActive = true; sync(); });
  listen(win, 'orientationchange', resetForOrientation, { passive: true });
  listen(win, 'resize', resetForOrientation, { passive: true });
  listen(win.screen?.orientation, 'change', resetForOrientation);
  listen(reduced, 'change', () => { zero(); sync(); });
  listen(coarse, 'change', () => { detachGravity(); zero(); sync(); });
  mount();
  return { destroy() { appObserver.disconnect(); stateObserver.disconnect(); removers.forEach(remove => remove()); releasePortal(); } };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const key = Symbol.for('nextround.portal-motion');
  if (!window[key]) window[key] = createPortalMotion();
}
