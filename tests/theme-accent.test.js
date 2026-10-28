import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCENT_STORAGE_KEY, accentColorFor, applyAccentPrefs, contrastRatio,
  deriveAccentPalette, loadAccentPrefs, normalizeAccentPrefs, pinAccent,
  saveAccentPrefs, unpinAccent,
} from "../theme-accent.js";

test("accent choices are validated, saved separately for both themes, and limited to seven unique slots", () => {
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  let prefs = normalizeAccentPrefs({ light: "#abc", dark: "not a color", pinned: ["#abc", "#aabbcc", "#123456"] });
  assert.equal(accentColorFor(prefs, "light"), "#aabbcc");
  assert.equal(accentColorFor(prefs, "dark"), "#bff55c");
  assert.deepEqual(prefs.pinned.slice(0, 3), ["#aabbcc", null, "#123456"]);
  for (const color of ["#111111", "#222222", "#333333", "#444444", "#555555"]) prefs = pinAccent(prefs, color).prefs;
  assert.equal(prefs.pinned.filter(Boolean).length, 7);
  assert.equal(pinAccent(prefs, "#666666").status, "full");
  prefs = unpinAccent(prefs, 1);
  assert.equal(pinAccent(prefs, "#666666").status, "added");
  prefs.dark = "#1264bd";
  saveAccentPrefs(prefs, storage);
  assert.equal(loadAccentPrefs(storage).dark, "#1264bd");
  assert.ok(store.has(ACCENT_STORAGE_KEY));
});

test("chosen accents remain readable at black and white extremes and reset without residual variables", () => {
  const light = deriveAccentPalette("#ffffff", "light");
  const dark = deriveAccentPalette("#000000", "dark");
  assert.ok(contrastRatio(light.ink, "#fbf9f0") >= 4.5);
  assert.ok(contrastRatio(dark.ink, "#171717") >= 4.5);
  assert.ok(contrastRatio(light.fill, "#fbf9f0") >= 3);
  assert.ok(contrastRatio(dark.fill, "#171717") >= 3);
  const attributes = new Map(), properties = new Map();
  const body = {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) },
  };
  applyAccentPrefs({ light: "#ffffff" }, "light", body);
  assert.equal(attributes.get("data-user-accent"), "light");
  assert.equal(properties.get("--user-accent-ink"), light.ink);
  applyAccentPrefs({ light: null }, "light", body);
  assert.equal(attributes.has("data-user-accent"), false);
  assert.equal(properties.size, 0);
});
