/** Independent source cards and immutable, ordered snapshots inside answers/scripts. */
import { uid } from "./core.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function requireValue(condition, message) {
  if (!condition) throw new Error(`内容编排失败：${message}`);
}
function validateParts(parts) {
  requireValue(Array.isArray(parts), "分段必须是数组");
  const ids = new Set();
  for (const part of parts) {
    requireValue(isObject(part) && typeof part.id === "string" && part.id.trim() && part.id.length <= 200 && !ids.has(part.id), "分段 ID 无效或重复");
    requireValue(part.sourceCardId === null || (typeof part.sourceCardId === "string" && part.sourceCardId.trim() && part.sourceCardId.length <= 200), "来源卡片 ID 无效");
    requireValue(typeof part.title === "string" && typeof part.text === "string" && (part.variant === undefined || typeof part.variant === "string"), "分段标题、正文和版本必须是文本");
    ids.add(part.id);
  }
}
export function compositionToText(parts) {
  validateParts(parts);
  return parts.map((part) => part.text).join("\n\n");
}
function editable(record, contentKey) {
  requireValue(isObject(record), "记录无效");
  requireValue(["answer", "content"].includes(contentKey), "正文字段只能是 answer 或 content");
  requireValue(record[contentKey] === undefined || typeof record[contentKey] === "string", "原有正文必须是文本");
  const next = structuredClone(record);
  if (record.composition !== undefined) validateParts(record.composition);
  if (record.composition?.length) {
    requireValue(compositionToText(record.composition) === (record[contentKey] || ""), "当前正文与分段不一致，请先保存手写内容");
  } else {
    next.composition = record[contentKey] ? [{ id: uid(), sourceCardId: null, title: "手写内容", text: record[contentKey] }] : [];
  }
  return next;
}
function complete(record, contentKey) {
  record[contentKey] = compositionToText(record.composition);
  return record;
}
function indexOf(record, partId) {
  const index = record.composition.findIndex((part) => part.id === partId);
  requireValue(index !== -1, "找不到要编辑的分段");
  return index;
}
export function appendCardComposition(record, card, contentKey) {
  requireValue(isObject(card) && typeof card.id === "string" && card.id.trim() && card.id.length <= 200 && typeof card.title === "string" && typeof card.content === "string" && (card.variant === undefined || typeof card.variant === "string"), "素材卡数据无效");
  const next = editable(record, contentKey);
  next.composition.push({ id: uid(), sourceCardId: card.id, title: card.title, text: card.content, ...(card.variant === undefined ? {} : { variant: card.variant }) });
  return complete(next, contentKey);
}
/** A null destination places the part at the end. */
export function moveCompositionPart(record, partId, beforePartId, contentKey) {
  const next = editable(record, contentKey), index = indexOf(next, partId);
  if (partId === beforePartId) return complete(next, contentKey);
  if (beforePartId !== null) indexOf(next, beforePartId);
  const [part] = next.composition.splice(index, 1);
  const destination = beforePartId === null ? next.composition.length : indexOf(next, beforePartId);
  next.composition.splice(destination, 0, part);
  return complete(next, contentKey);
}
export function removeCompositionPart(record, partId, contentKey) {
  const next = editable(record, contentKey);
  next.composition.splice(indexOf(next, partId), 1);
  return complete(next, contentKey);
}
export function updateCompositionPart(record, partId, text, contentKey) {
  requireValue(typeof text === "string", "分段正文必须是文本");
  const next = editable(record, contentKey);
  next.composition[indexOf(next, partId)].text = text;
  return complete(next, contentKey);
}
