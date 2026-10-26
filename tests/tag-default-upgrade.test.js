import test from "node:test";
import assert from "node:assert/strict";
import { blankState, upgradeLegacyTagColorDefaults } from "../core.js";

test("only untouched old tag defaults migrate from yellow zero to risk minus one", () => {
  const old = blankState();
  old.settings.tagColorScores.yellow = 0;
  const upgraded = upgradeLegacyTagColorDefaults(old);
  assert.equal(upgraded.settings.tagColorScores.yellow, -1);
  assert.equal(old.settings.tagColorScores.yellow, 0);
  assert.equal(upgradeLegacyTagColorDefaults(upgraded), upgraded);

  const custom = structuredClone(old);
  custom.settings.tagColorScores.green = 5;
  assert.equal(upgradeLegacyTagColorDefaults(custom), custom);
  const explicitZero = structuredClone(old);
  explicitZero.settings.tagScoreDefaultsVersion = 2;
  assert.equal(upgradeLegacyTagColorDefaults(explicitZero), explicitZero);
});
