import test from "node:test";
import assert from "node:assert/strict";
import { TRAINING_MODULES, trainingModuleForQuestion } from "../training-modules.js";

test("training menu uses six requested modules and keeps legacy question categories usable", () => {
  assert.equal(TRAINING_MODULES.length, 6);
  assert.equal(trainingModuleForQuestion({ category: "项目经历" }), TRAINING_MODULES[0]);
  assert.equal(trainingModuleForQuestion({ category: "自我介绍" }), TRAINING_MODULES[1]);
  assert.equal(trainingModuleForQuestion({ category: "专业能力" }), TRAINING_MODULES[2]);
  assert.equal(trainingModuleForQuestion({ category: "M5｜能力实操补强" }), TRAINING_MODULES[4]);
});
