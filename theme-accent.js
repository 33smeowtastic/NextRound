export const ACCENT_STORAGE_KEY = "nextround-accent-preferences-v1";
export const DEFAULT_ACCENTS = Object.freeze({ light: "#d1b98d", dark: "#bff55c" });
export const PINNED_ACCENT_COUNT = 7;

export function normalizeAccentColor(value) {
  if (typeof value !== "string") return null;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) return `#${[...color.slice(1)].map(ch => ch + ch).join("")}`;
  return null;
}

export function normalizeAccentPrefs(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const pinned = Array(PINNED_ACCENT_COUNT).fill(null);
  const seen = new Set();
  for (let i = 0; i < PINNED_ACCENT_COUNT; i++) {
    const color = normalizeAccentColor(Array.isArray(source.pinned) ? source.pinned[i] : null);
    if (color && !seen.has(color)) { pinned[i] = color; seen.add(color); }
  }
  return { light: normalizeAccentColor(source.light), dark: normalizeAccentColor(source.dark), pinned };
}

export function loadAccentPrefs(storage) {
  try {
    const saved = (storage ?? globalThis.localStorage)?.getItem(ACCENT_STORAGE_KEY);
    return normalizeAccentPrefs(saved && saved.length < 2048 ? JSON.parse(saved) : null);
  } catch { return normalizeAccentPrefs(null); }
}

export function saveAccentPrefs(prefs, storage) {
  (storage ?? globalThis.localStorage).setItem(ACCENT_STORAGE_KEY, JSON.stringify(normalizeAccentPrefs(prefs)));
}

export function accentColorFor(prefs, mode) {
  return normalizeAccentColor(prefs?.[mode]) || DEFAULT_ACCENTS[mode === "dark" ? "dark" : "light"];
}

export function pinAccent(prefs, color) {
  const next = normalizeAccentPrefs(prefs);
  const chosen = normalizeAccentColor(color);
  if (!chosen) return { prefs: next, status: "invalid" };
  if (next.pinned.includes(chosen)) return { prefs: next, status: "exists" };
  const index = next.pinned.indexOf(null);
  if (index === -1) return { prefs: next, status: "full" };
  next.pinned[index] = chosen;
  return { prefs: next, status: "added", index };
}

export function unpinAccent(prefs, index) {
  const next = normalizeAccentPrefs(prefs);
  if (Number.isInteger(index) && index >= 0 && index < PINNED_ACCENT_COUNT) next.pinned[index] = null;
  return next;
}

const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
const hex = channels => `#${channels.map(value => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
const blend = (a, b, fraction) => hex(rgb(a).map((value, index) => value + (rgb(b)[index] - value) * fraction));
const luminance = color => rgb(color).map(value => {
  const channel = value / 255;
  return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}
function ensureContrast(color, background, minimum, toward) {
  if (contrastRatio(color, background) >= minimum) return color;
  let low = 0, high = 1;
  for (let i = 0; i < 16; i++) {
    const midpoint = (low + high) / 2;
    if (contrastRatio(blend(color, toward, midpoint), background) >= minimum) high = midpoint;
    else low = midpoint;
  }
  return blend(color, toward, high);
}

export function deriveAccentPalette(color, mode) {
  const raw = normalizeAccentColor(color) || DEFAULT_ACCENTS[mode === "dark" ? "dark" : "light"];
  const dark = mode === "dark";
  const surface = dark ? "#171717" : "#fbf9f0";
  const toward = dark ? "#ffffff" : "#000000";
  const fill = ensureContrast(raw, surface, 3, toward);
  const ink = ensureContrast(raw, surface, 4.5, toward);
  const on = contrastRatio(fill, "#ffffff") >= contrastRatio(fill, "#101010") ? "#ffffff" : "#101010";
  const portal = ensureContrast(raw, "#090908", 3, "#ffffff");
  return {
    raw, fill, ink, on,
    soft: blend(surface, raw, dark ? .19 : .15),
    border: blend(surface, fill, dark ? .55 : .48),
    hover: blend(fill, dark ? "#ffffff" : "#000000", .11),
    portal,
    portalLight: blend(portal, "#ffffff", .48),
    portalSoft: blend("#090908", portal, .28),
  };
}

const APPLIED_PROPERTIES = [
  "--user-accent-raw", "--user-accent-fill", "--user-accent-ink", "--user-accent-on",
  "--user-accent-soft", "--user-accent-border", "--user-accent-hover",
  "--user-portal-accent", "--user-portal-light", "--user-portal-soft",
  "--signal", "--gold-ink", "--primary", "--archive-button-gold", "--ui-focus",
];
export function applyAccentPrefs(prefs, mode, body = document.body) {
  const custom = normalizeAccentColor(prefs?.[mode]);
  if (!custom) {
    body.removeAttribute("data-user-accent");
    APPLIED_PROPERTIES.forEach(property => body.style.removeProperty(property));
    return null;
  }
  const palette = deriveAccentPalette(custom, mode);
  body.setAttribute("data-user-accent", mode);
  const values = {
    "--user-accent-raw": palette.raw,
    "--user-accent-fill": palette.fill,
    "--user-accent-ink": palette.ink,
    "--user-accent-on": palette.on,
    "--user-accent-soft": palette.soft,
    "--user-accent-border": palette.border,
    "--user-accent-hover": palette.hover,
    "--user-portal-accent": palette.portal,
    "--user-portal-light": palette.portalLight,
    "--user-portal-soft": palette.portalSoft,
    "--signal": palette.fill,
    "--gold-ink": palette.ink,
    "--primary": palette.fill,
    "--archive-button-gold": palette.fill,
    "--ui-focus": palette.fill,
  };
  for (const [property, value] of Object.entries(values)) body.style.setProperty(property, value);
  return palette;
}
