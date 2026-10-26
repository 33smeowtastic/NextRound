import { helpTip } from "./help-ui.js";
import { orderedCardTags, filterContentCards } from "./card-tags.js";
/** Reusable content-card and composition editor markup. All user text is escaped. */
export function contentCardEditor(row, { textField, area }) {
  return `<div class="editor-help-actions">${helpTip("把可复用的表达存成独立卡片，例如开场、项目经历、岗位匹配。短版和长版可以分别保存，回答问题时再自由拼接。修改卡片会更新卡片库；已经拼入回答或介绍稿的内容保留当时的副本，可以单独修改。", "编辑内容卡片说明")}</div>
    <div class="form-grid content-card-form">
      ${textField("title", "卡片标题 *", row.title || "", "text", 'required full placeholder="例如：自我介绍 · 项目经历"')}
      ${textField("category", "类别", row.category || "", "text", 'placeholder="例如：自我介绍、项目经历"')}
      ${textField("variant", "版本 / 分段", row.variant || "", "text", 'placeholder="例如：短版、长版、开场"')}
      ${area("content", "卡片正文 *", row.content || "", 'required rows="9" placeholder="写下这一张卡片要表达的内容…"')}
      ${textField("tagText", "标签 · 用逗号分隔", (row.tags || []).join("，"), "text", "full")}
    </div>
    `;
}
function grip() {
  return '<span class="composition-grip" draggable="true" aria-hidden="true"><svg viewBox="0 0 16 20" fill="currentColor"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="10" r="1.2"/><circle cx="11" cy="10" r="1.2"/><circle cx="5" cy="16" r="1.2"/><circle cx="11" cy="16" r="1.2"/></svg></span>';
}
function arrow(direction) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="${direction === "up" ? "m6 14 6-6 6 6" : "m6 10 6 6 6-6"}"/></svg>`;
}
function sourceCard(card, esc) {
  const id = esc(card.id);
  return `<article class="composition-source" draggable="true" data-content-card="${id}" aria-label="内容卡片：${esc(card.title || "未命名卡片")}">
    <div class="composition-source-heading">${grip()}<div class="grow"><h4>${esc(card.title || "未命名卡片")}</h4><div class="composition-meta">${[card.category, card.variant].filter(Boolean).map(value => `<span>${esc(value)}</span>`).join("")}</div></div><button type="button" class="composition-add" data-action="composition-add" data-card="${id}" aria-label="添加卡片：${esc(card.title || "未命名卡片")}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg> 添加</button></div>
    <details class="composition-source-preview"><summary>查看正文 <span>${String(card.content || "").length} 字</span></summary><p>${esc(card.content || "尚未填写正文")}</p></details>
  </article>`;
}
function partCard(part, index, total, esc) {
  const id = esc(part.id);
  const title = part.title || "手写内容";
  return `<section class="composition-part" draggable="true" data-composition-part="${id}" data-composition-drop="${id}" aria-label="第 ${index + 1} 段：${esc(title)}">
    <div class="composition-part-heading">${grip()}<span class="composition-order">${String(index + 1).padStart(2, "0")}</span><div class="grow"><h4>${esc(title)}</h4>${part.variant ? `<span class="composition-variant">${esc(part.variant)}</span>` : ""}</div><div class="composition-part-actions"><button type="button" class="icon-btn" data-action="composition-up" data-part="${id}" aria-label="上移第 ${index + 1} 段" ${index === 0 ? "disabled" : ""}>${arrow("up")}</button><button type="button" class="icon-btn" data-action="composition-down" data-part="${id}" aria-label="下移第 ${index + 1} 段" ${index === total - 1 ? "disabled" : ""}>${arrow("down")}</button><button type="button" class="icon-btn composition-remove" data-action="composition-remove" data-part="${id}" aria-label="移除第 ${index + 1} 段"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m7 7 10 10M7 17 17 7"/></svg></button></div></div>
    <label class="composition-part-label"><span class="sr-only">第 ${index + 1} 段正文</span><textarea rows="4" draggable="false" data-composition-text="${id}" aria-label="第 ${index + 1} 段正文">${esc(part.text || "")}</textarea></label>
  </section>`;
}
export function cardTagBar(cards, order, selected, scope, esc) {
  const tags = orderedCardTags(cards, order);
  if (!tags.length) return "";
  return `<div class="card-tag-filter"><div class="card-tag-bar" role="group" aria-label="内容卡片标签筛选"><button type="button" class="card-tag ${!selected ? "is-selected" : ""}" data-action="filter-card-tag" data-scope="${scope}" data-tag="" aria-pressed="${!selected}">全部</button>${tags.map((tag) => `<button type="button" class="card-tag ${tag === selected ? "is-selected" : ""}" data-action="filter-card-tag" data-sort-tag="${esc(tag)}" data-scope="${scope}" data-tag="${esc(tag)}" aria-pressed="${tag === selected}" title="点击筛选；长按拖动排序，或按 Alt + 左右方向键">${esc(tag)}</button>`).join("")}${helpTip("点击筛选。长按拖动标签，调整标签优先级和卡片顺序；也可使用 Alt + 左右方向键。", "标签筛选与排序说明")}</div></div>`;
}
export function compositionEditor(row, contentKey, cards, { esc, area, tagOrder = [], selectedTag = null, undoParts = [] }) {
  const parts = Array.isArray(row.composition) ? row.composition : [];
  const full = row[contentKey] || "";
  const isAnswer = contentKey === "answer";
  const selected = orderedCardTags(cards, tagOrder).includes(selectedTag) ? selectedTag : null;
  const shownCards = filterContentCards(cards, selected, tagOrder);
  const lastRemoved = undoParts.at(-1);
  return `<section class="composition-editor full" aria-label="内容拼接工作台">
    <header class="composition-heading"><div><h3>拼接${isAnswer ? "回答" : "介绍稿"} ${helpTip("从卡片库拖入段落，或点击「添加」，再调整顺序与措辞。添加的是内容副本，原卡片不会被改动。", "拼接内容说明")}</h3></div><span class="composition-count" data-composition-count>${parts.length} 段</span></header>
    ${lastRemoved ? `<div class="composition-undo" role="status"><span>已移除「${esc(lastRemoved.part.title || "手写内容")}」</span><button type="button" class="text-btn" data-action="composition-undo">撤回删除</button></div>` : ""}
    <div class="composition-workbench">
      <div class="composition-canvas"><div class="composition-column-heading"><h4>已拼内容</h4><span>按顺序组成全文</span></div>
        <div class="composition-parts" data-composition-list>${parts.map((part, index) => partCard(part, index, parts.length, esc)).join("")}</div>
        <div class="composition-dropzone ${parts.length ? "" : "is-empty"}" data-composition-drop=""><span class="composition-drop-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg></span><p>${parts.length ? "拖到这里，接在最后一段" : full ? "原有全文会保留" : "从第一张卡片开始"}</p><small>${parts.length ? "也可以点击卡片上的「添加」" : full ? "添加卡片后接在原文之后，可继续编辑与排序。" : "拖入卡片，手机上点击「添加」即可。"}</small></div>
      </div>
      <aside class="composition-library" aria-label="可用内容卡片"><div class="composition-column-heading"><h4>内容卡片 <small>${cards.length}</small></h4><button type="button" class="text-btn" data-action="manage-content-cards">管理卡片</button></div>${cardTagBar(cards, tagOrder, selected, "composer", esc)}<div class="composition-source-list">${shownCards.length ? shownCards.map(card => sourceCard(card, esc)).join("") : cards.length ? '<p class="form-help">此标签下没有卡片，点击「全部」查看。</p>'  : '<div class="composition-library-empty"><h4>还没有内容卡片</h4><p>先把常用的开场、经历或结尾分别存成卡片。</p><button type="button" class="btn secondary small" data-action="manage-content-cards">去创建内容卡片</button></div>'}</div></aside>
    </div>
    <div class="composition-full"><div class="composition-column-heading"><h4>完整${isAnswer ? "回答" : "介绍稿"} ${helpTip("调整分段会同步全文。直接修改完整正文会清除当前分段，保留修改后的全文；仍可继续添加卡片。", "完整正文编辑说明", "composition-full-help")}</h4></div>${area(contentKey, `完整${isAnswer ? "回答" : "介绍稿"}正文`, full, 'rows="8" data-composition-full aria-describedby="composition-full-help"')}</div>
  </section>`;
}
