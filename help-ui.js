/** Small, shared explanations. Text-only content and delegated interactions. */
let sequence = 0;
let initialized = false;
let active = null;
let leaveTimer = null;
let observer;
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function helpTip(text, label = "查看说明", id) {
  const panelId = id ? String(id) : `help-tip-${++sequence}`;
  return `<span class="inline-help"><button type="button" class="help-trigger" data-help-trigger="${escapeHTML(panelId)}" aria-label="${escapeHTML(label)}" aria-expanded="false" aria-controls="${escapeHTML(panelId)}" aria-describedby="${escapeHTML(panelId)}"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="7.8" r=".9" fill="currentColor"/><path d="M12 11v5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button><span id="${escapeHTML(panelId)}" class="help-popover" data-help-panel popover="manual" role="tooltip">${escapeHTML(text)}</span></span>`;
}

function clearLeaveTimer() {
  clearTimeout(leaveTimer);
  leaveTimer = null;
}
function belongsToActive(node) {
  return active && node instanceof Node && (active.trigger.contains(node) || active.panel.contains(node));
}
function positionPanel() {
  if (!active) return;
  const { trigger, panel } = active;
  const bounds = trigger.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight;
  const margin = 12, gap = 8;
  if (bounds.bottom <= 0 || bounds.top >= viewportHeight || bounds.right <= 0 || bounds.left >= viewportWidth) {
    closeHelpTips();
    return;
  }
  panel.style.width = `${Math.max(0, Math.min(320, viewportWidth - margin * 2))}px`;
  panel.style.maxHeight = `${Math.max(0, viewportHeight - margin * 2)}px`;
  const natural = panel.getBoundingClientRect();
  const below = Math.max(0, viewportHeight - margin - bounds.bottom - gap);
  const above = Math.max(0, bounds.top - margin - gap);
  const placeBelow = natural.height <= below || below >= above;
  panel.style.maxHeight = `${placeBelow ? below : above}px`;
  const dimensions = panel.getBoundingClientRect();
  const left = Math.max(margin, Math.min(bounds.left, viewportWidth - margin - dimensions.width));
  const top = placeBelow ? bounds.bottom + gap : bounds.top - gap - dimensions.height;
  panel.style.left = `${left}px`;
  panel.style.top = `${Math.max(margin, top)}px`;
  panel.dataset.helpPlacement = placeBelow ? "below" : "above";
}

export function closeHelpTips() {
  clearLeaveTimer();
  if (!active) return;
  const closing = active;
  active = null;
  closing.trigger.setAttribute("aria-expanded", "false");
  closing.panel.removeAttribute("data-help-open");
  try {
    if (closing.native) closing.panel.hidePopover();
  } catch { /* Removal of a rendered dialog also removes its native top-layer entry. */ }
  if (closing.fallbackHome) {
    const { parent, next } = closing.fallbackHome;
    if (parent.isConnected) parent.insertBefore(closing.panel, next?.parentNode === parent ? next : null);
    else closing.panel.remove();
    closing.panel.setAttribute("popover", "manual");
  }
}
function openTip(trigger) {
  clearLeaveTimer();
  if (active?.trigger === trigger) return active;
  closeHelpTips();
  const panel = document.getElementById(trigger.dataset.helpTrigger);
  if (!panel || !trigger.isConnected) return null;
  active = { trigger, panel, clicked: false, pointerWithinPanel: false, native: false, fallbackHome: null };
  trigger.setAttribute("aria-expanded", "true");
  panel.style.left = "12px";
  panel.style.top = "12px";
  panel.dataset.helpOpen = "true";
  try {
    if (typeof panel.showPopover !== "function") throw new Error("Popover unsupported");
    panel.showPopover();
    active.native = true;
  } catch {
    active.fallbackHome = { parent: panel.parentNode, next: panel.nextSibling };
    panel.removeAttribute("popover");
    // A fallback inside an open dialog must stay in that dialog's top layer.
    (trigger.closest("dialog[open]") || document.body).append(panel);
  }
  positionPanel();
  return active;
}
function leaveSoon() {
  clearLeaveTimer();
  leaveTimer = setTimeout(closeHelpTips, 120);
}
function hoverPointer(event) {
  return event.pointerType === "mouse" || event.pointerType === "pen";
}

export function initHelpTips() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("pointerover", event => {
    if (!hoverPointer(event) || !(event.target instanceof Element)) return;
    const trigger = event.target.closest("[data-help-trigger]");
    if (trigger) { openTip(trigger); return; }
    if (active?.panel.contains(event.target)) {
      clearLeaveTimer();
      active.pointerWithinPanel = true;
    }
  });
  document.addEventListener("pointerout", event => {
    if (!hoverPointer(event) || !belongsToActive(event.target)) return;
    if (belongsToActive(event.relatedTarget)) return;
    if (active) active.pointerWithinPanel = false;
    leaveSoon();
  });
  document.addEventListener("focusin", event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest("[data-help-trigger]");
    if (trigger) openTip(trigger);
  });
  document.addEventListener("focusout", event => {
    if (!belongsToActive(event.target) || belongsToActive(event.relatedTarget)) return;
    if (active?.pointerWithinPanel && event.relatedTarget === null) return;
    closeHelpTips();
  });
  document.addEventListener("pointerdown", event => {
    if (active && !belongsToActive(event.target)) closeHelpTips();
  }, true);
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest("[data-help-trigger]");
    if (!trigger) return;
    // Focusing or hovering may already have opened this tip before its first click.
    if (active?.trigger === trigger && active.clicked) { closeHelpTips(); return; }
    const tip = openTip(trigger);
    if (tip) tip.clicked = true;
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !active) return;
    event.preventDefault();
    event.stopPropagation();
    closeHelpTips();
  }, true);
  document.addEventListener("scroll", event => {
    if (active && (event.target === active.panel || active.panel.contains(event.target))) return;
    closeHelpTips();
  }, true);
  window.addEventListener("resize", closeHelpTips);
  window.addEventListener("blur", closeHelpTips);
  observer = new MutationObserver(() => {
    if (active && (!active.trigger.isConnected || !active.panel.isConnected)) closeHelpTips();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
