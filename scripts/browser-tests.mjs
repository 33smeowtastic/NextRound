/** Current browser regression entrypoints included in the reproducible source package. */
export const BROWSER_TESTS = Object.freeze([
  "training-finish-workspace",
  "import-security",
  "portal-registration",
  "ui-standards",
  "chooser-standards",
  "release-onboarding",
  "salary-months",
  "seo-visibility",
  "knowledge-guide",
  "settings-ai-archive",
  "portal-motion",
  "portal-wizard",
  "chrome-review",
  "navigation-training",
  "paired-bgm",
  "tags-undo-bgm",
  "trash-import",
  "agenda-scroll",
].map(name => Object.freeze({ name, file: `tests/${name}-browser.mjs` })));

// These files remain local historical evidence; they assert superseded UI/assets.
export const HISTORICAL_BROWSER_TESTS = Object.freeze({
  "tests/visual-smoke.mjs": "Historical V3 whole-scene layout and asset assertions; replaced by portal-registration and current module suites.",
  "tests/v3-corner.mjs": "Historical V3 corner control layout; replaced by chrome-review/navigation-training.",
});
