/** Source-card tag discovery, stable display ordering and filtering. No state mutation. */
function requireValue(condition, message) {
  if (!condition) throw new Error(`卡片标签操作失败：${message}`);
}
function checkedOrder(order) {
  requireValue(Array.isArray(order), "标签顺序必须是文本数组");
  const normalized = order.map((tag) => {
    requireValue(typeof tag === "string" && tag.trim(), "标签顺序不能包含空标签或非文本");
    return tag.trim();
  });
  requireValue(new Set(normalized).size === normalized.length, "标签顺序不能重复");
  return normalized;
}
function checkedCards(cards) {
  requireValue(Array.isArray(cards), "素材卡必须是数组");
  return cards;
}
export function cardTags(card) {
  if (!card || typeof card !== "object" || Array.isArray(card)) return [];
  const candidates = [card.category, card.variant, ...(Array.isArray(card.tags) ? card.tags : [])];
  return [...new Set(candidates.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))];
}
/** Project saved order onto current tags; callers keep the original saved order for absent tags. */
export function orderedCardTags(cards, savedOrder = []) {
  const order = checkedOrder(savedOrder);
  const current = new Set(checkedCards(cards).flatMap(cardTags));
  return [...order.filter((tag) => current.has(tag)), ...[...current].filter((tag) => !order.includes(tag))];
}
export function sortContentCards(cards, tagOrder = []) {
  const order = orderedCardTags(cards, tagOrder), rank = new Map(order.map((tag, index) => [tag, index]));
  return cards.map((card, index) => ({ card, index, rank: cardTags(card).reduce((best, tag) => Math.min(best, rank.get(tag)), Infinity) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ card }) => card);
}
export function filterContentCards(cards, selectedTag = null, tagOrder = []) {
  requireValue(selectedTag === null || typeof selectedTag === "string", "筛选标签必须是文本");
  const selected = selectedTag?.trim() || "";
  // Rank before filtering so newly seen tags keep the same priority as in the complete library.
  const sorted = sortContentCards(cards, tagOrder);
  return selected ? sorted.filter((card) => cardTags(card).includes(selected)) : sorted;
}
/** Move one existing tag before another; null places it at the end. */
export function reorderCardTag(order, dragged, before = null) {
  const next = checkedOrder(order);
  requireValue(typeof dragged === "string" && next.includes(dragged.trim()), "找不到要拖动的标签");
  requireValue(before === null || (typeof before === "string" && next.includes(before.trim())), "找不到目标标签");
  const source = dragged.trim(), target = before === null ? null : before.trim();
  if (source === target) return next;
  next.splice(next.indexOf(source), 1);
  next.splice(target === null ? next.length : next.indexOf(target), 0, source);
  return next;
}
