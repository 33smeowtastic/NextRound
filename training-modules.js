/** Training themes are distinct from the original question-bank categories. */
export const TRAINING_MODULES = Object.freeze([
  "M1｜项目深度追问",
  "M2｜通用面试追问",
  "M3｜专业知识与术语",
  "M4｜业务方向追问",
  "M5｜能力实操补强",
  "M6｜能力证据准备",
]);

const LEGACY_MODULES = Object.freeze({
  项目经历: TRAINING_MODULES[0],
  自我介绍: TRAINING_MODULES[1],
  协作沟通: TRAINING_MODULES[1],
  求职动机: TRAINING_MODULES[1],
  综合分析: TRAINING_MODULES[1],
  组织计划: TRAINING_MODULES[1],
  应急应变: TRAINING_MODULES[1],
  人际沟通: TRAINING_MODULES[1],
  岗位认知: TRAINING_MODULES[1],
  自我认知: TRAINING_MODULES[1],
  专业能力: TRAINING_MODULES[2],
});

export function trainingModuleForQuestion(question) {
  const category = String(question?.category || "").trim();
  return TRAINING_MODULES.find((module) => category === module || category.startsWith(module.slice(0, 2)))
    || LEGACY_MODULES[category]
    || TRAINING_MODULES[1];
}
