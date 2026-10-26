/** Themeable chooser surfaces. Native form fields remain the source of truth. */
export const dateKey = date => `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth()+1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return null;
  const date = new Date(0);
  date.setFullYear(Number(match[1]), Number(match[2])-1, Number(match[3]));
  date.setHours(12, 0, 0, 0);
  return dateKey(date) === match[0] ? date : null;
}
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const arrow = direction => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${direction < 0 ? "m10 3-5 5 5 5" : "m6 3 5 5-5 5"}"/></svg>`;
let initialized = false;
let sequence = 0;
let active = null;
let search = "";
let searchTimer;

function closeChooser(restore = false) {
  if (!active) return;
  const previous = active;
  active = null;
  for (const [name, value] of previous.attributes) {
    if (value === null) previous.trigger.removeAttribute(name);
    else previous.trigger.setAttribute(name, value);
  }
  previous.popup.remove();
  if (restore && previous.trigger.isConnected) previous.trigger.focus({preventScroll:true});
}
function positionChooser() {
  if (!active) return;
  const {trigger, popup, kind} = active;
  if (!trigger.isConnected) { closeChooser(); return; }
  const rect = trigger.getBoundingClientRect(), margin = 12, gap = 6;
  const width = Math.min(kind === "select" ? Math.max(180, rect.width) : 304, innerWidth-margin*2);
  popup.style.width = `${width}px`;
  const below = innerHeight-rect.bottom-margin-gap, above = rect.top-margin-gap;
  const useBelow = below >= Math.min(popup.scrollHeight, 280) || below >= above;
  popup.style.maxHeight = `${Math.max(90, Math.min(420, useBelow ? below : above))}px`;
  const height = popup.getBoundingClientRect().height;
  popup.style.left = `${Math.max(margin, Math.min(rect.left, innerWidth-width-margin))}px`;
  popup.style.top = `${Math.max(margin, useBelow ? rect.bottom+gap : rect.top-gap-height)}px`;
}
function createChooser(trigger, kind) {
  closeChooser();
  search="";clearTimeout(searchTimer);
  const popup = document.createElement("div");
  popup.id = `themed-chooser-${++sequence}`;
  popup.className = `themed-control-popup themed-${kind}-popup`;
  popup.setAttribute("popover", "manual");
  const label = trigger.getAttribute("aria-label") || trigger.labels?.[0]?.firstChild?.textContent?.trim() || (kind === "select" ? "选择选项" : "选择日期与时间");
  popup.setAttribute("aria-label", label);
  popup.setAttribute("role", kind === "select" ? "listbox" : "dialog");
  const attributes = ["aria-expanded", "aria-controls", "aria-haspopup"].map(name => [name, trigger.getAttribute(name)]);
  // Native date/time inputs do not support aria-expanded; the select combobox does.
  if (kind === "select") trigger.setAttribute("aria-expanded", "true");
  trigger.setAttribute("aria-haspopup", kind === "select" ? "listbox" : "dialog");
  trigger.setAttribute("aria-controls", popup.id);
  (trigger.closest("dialog[open]") || document.body).append(popup);
  active = {trigger, popup, kind, attributes};
  try { popup.showPopover(); } catch { popup.removeAttribute("popover"); }
  return active;
}
function commitValue(trigger, value) {
  const changed = trigger.value !== value;
  trigger.value = value;
  closeChooser(true);
  if (changed) {
    trigger.dispatchEvent(new Event("input", {bubbles:true}));
    trigger.dispatchEvent(new Event("change", {bubbles:true}));
  }
}
function openSelect(trigger) {
  const current = createChooser(trigger, "select");
  let group = null;
  current.popup.innerHTML = [...trigger.options].map((option, index) => {
    if (option.hidden || option.parentElement.hidden) return "";
    let heading = "";
    if (option.parentElement.tagName === "OPTGROUP" && option.parentElement !== group) {
      group = option.parentElement;
      heading = `<div class="themed-select-group" role="presentation">${escape(group.label)}</div>`;
    }
    return heading + `<button type="button" class="themed-select-option" role="option" tabindex="-1" data-option="${index}" aria-selected="${option.selected}" ${option.disabled || option.parentElement.disabled ? "disabled" : ""}>${escape(option.label)}</button>`;
  }).join("");
  current.popup.addEventListener("click", event => {
    const option = event.target.closest("[data-option]");
    if (!option || option.disabled || active !== current) return;
    const index = Number(option.dataset.option), changed = trigger.selectedIndex !== index;
    trigger.selectedIndex = index;
    closeChooser(true);
    if (changed) {
      trigger.dispatchEvent(new Event("input", {bubbles:true}));
      trigger.dispatchEvent(new Event("change", {bubbles:true}));
    }
  });
  positionChooser();
  const selected = current.popup.querySelector('[aria-selected="true"]:not(:disabled)') || current.popup.querySelector("[data-option]:not(:disabled)");
  selected?.focus({preventScroll:true});
  selected?.scrollIntoView({block:"nearest"});
}
function validDate(trigger, key) {
  const min = trigger.min?.slice(0,10), max = trigger.max?.slice(0,10);
  if ((min && key < min) || (max && key > max)) return false;
  const step = Number(trigger.step);
  if (trigger.type === "date" && step > 1) {
    const origin = parseLocalDate(min || trigger.getAttribute("value")) || parseLocalDate("1970-01-01");
    const date = parseLocalDate(key);
    const days = Math.round((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-Date.UTC(origin.getFullYear(),origin.getMonth(),origin.getDate()))/86400000);
    if (days % step !== 0) return false;
  }
  return true;
}
function focusDate(key) {
  const current = active;
  if (!current) return;
  const target = [...current.popup.querySelectorAll("[data-date]:not(:disabled)")].find(button => button.dataset.date === key);
  if (!target) return;
  current.focusedDate = key;
  current.popup.querySelectorAll("[data-date]").forEach(button => button.tabIndex = button === target ? 0 : -1);
  target.focus({preventScroll:true});
}
function renderCalendar() {
  if (!active || active.kind === "select") return;
  const current = active, {trigger, popup} = current;
  const year = current.view.getFullYear(), month = current.view.getMonth();
  const today = dateKey(new Date()), chosen = current.chosen;
  const startYear = Math.floor(year/12)*12;
  const title = current.mode === "days" ? `${year}年 ${month+1}月` : current.mode === "months" ? `${year}年` : `${startYear}—${startYear+11}`;
  let body = "";
  if (current.kind !== "time") {
    body = `<div class="themed-calendar-header"><button type="button" data-calendar-nav="-1" aria-label="上一${current.mode === "days" ? "月" : current.mode === "months" ? "年" : "组年份"}">${arrow(-1)}</button><button type="button" data-calendar-mode>${title}</button><button type="button" data-calendar-nav="1" aria-label="下一${current.mode === "days" ? "月" : current.mode === "months" ? "年" : "组年份"}">${arrow(1)}</button></div>`;
    if (current.mode === "days") {
      const first = new Date(year, month, 1, 12), offset = (first.getDay()+6)%7;
      const days = Array.from({length:42}, (_, index) => {
        const date = new Date(year, month, index-offset+1, 12), key = dateKey(date);
        const selected = key === chosen, outside = date.getMonth() !== month;
        const tabbable = key === (chosen || today);
        return `<button type="button" role="gridcell" data-date="${key}" ${outside ? 'data-outside="true"' : ""} ${key === today ? 'data-today="true"' : ""} tabindex="${tabbable ? "0" : "-1"}" aria-label="${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日" aria-selected="${selected}" ${validDate(trigger,key) ? "" : "disabled"}>${date.getDate()}</button>`;
      });
      const weeks = Array.from({ length: 6 }, (_, row) => `<div class="themed-calendar-row" role="row">${days.slice(row * 7, row * 7 + 7).join("")}</div>`).join("");
      body += `<div class="themed-calendar-week" aria-hidden="true">${["一","二","三","四","五","六","日"].map(day=>`<span>${day}</span>`).join("")}</div><div class="themed-calendar-days" role="grid" aria-label="${year}年${month+1}月">${weeks}</div>`;
    } else {
      body += `<div class="themed-calendar-choices">${Array.from({length:12},(_,index)=>{
        const value=current.mode === "months" ? index : startYear+index;
        return `<button type="button" data-calendar-choice="${value}" aria-pressed="${current.mode === "months" ? value === month : value === year}">${current.mode === "months" ? `${value+1}月` : `${value}年`}</button>`;
      }).join("")}</div>`;
    }
  }
  if (current.kind === "datetime-local" || current.kind === "time") {
    const [hour,minute] = current.time.split(":");
    body += `<div class="themed-time-fields"><input type="number" min="0" max="23" step="1" value="${Number(hour)}" data-time-hour required aria-label="小时"><span aria-hidden="true">:</span><input type="number" min="0" max="59" step="1" value="${Number(minute)}" data-time-minute required aria-label="分钟"></div>`;
  }
  body += `<div class="themed-calendar-footer"><button type="button" data-calendar-clear ${trigger.required ? "disabled" : ""}>清除</button>${current.kind === "time" ? "" : `<button type="button" data-calendar-today ${validDate(trigger,today) ? "" : "disabled"}>今天</button>`}${current.kind === "date" ? "" : '<button type="button" class="themed-apply" data-calendar-apply>确定</button>'}</div>`;
  popup.innerHTML = body;
  const enabled = [...popup.querySelectorAll("[data-date]:not(:disabled)")];
  const preferred = [current.focusedDate, chosen, today].map(key => enabled.find(button => button.dataset.date === key)).find(Boolean)
    || enabled.find(button => !button.hasAttribute("data-outside")) || enabled[0];
  popup.querySelectorAll("[data-date]").forEach(button => button.tabIndex = button === preferred ? 0 : -1);
  positionChooser();
}
function chooseDate(current, key) {
  if (!validDate(current.trigger,key)) return;
  current.chosen = key;
  if (current.kind === "date") commitValue(current.trigger,key);
  else {
    current.view = parseLocalDate(key);
    renderCalendar();
    focusDate(key);
  }
}
function openCalendar(trigger) {
  const current = createChooser(trigger, trigger.type);
  let date = parseLocalDate(trigger.value) || parseLocalDate(dateKey(new Date()));
  const min = parseLocalDate(trigger.min), max = parseLocalDate(trigger.max);
  if (min && date < min) date=min;
  if (max && date > max) date=max;
  current.view = date;
  current.chosen = trigger.type === "time" ? "" : trigger.value.slice(0,10);
  current.time = (trigger.type === "time" ? trigger.value : trigger.value.split("T")[1]) || "09:00";
  current.mode = "days";
  current.popup.addEventListener("focusin", event => {
    if (!event.target.matches("[data-date]:not(:disabled)")) return;
    current.focusedDate = event.target.dataset.date;
    current.popup.querySelectorAll("[data-date]").forEach(button => button.tabIndex = button === event.target ? 0 : -1);
  });
  current.popup.addEventListener("input", event => {
    if (!event.target.matches("[data-time-hour],[data-time-minute]")) return;
    event.stopPropagation();
    const hour=current.popup.querySelector("[data-time-hour]"),minute=current.popup.querySelector("[data-time-minute]");
    if (hour.value !== "" && minute.value !== "") current.time=`${String(Math.max(0,Math.min(23,Number(hour.value)))).padStart(2,"0")}:${String(Math.max(0,Math.min(59,Number(minute.value)))).padStart(2,"0")}`;
  });
  current.popup.addEventListener("change", event => {
    if (event.target.matches("[data-time-hour],[data-time-minute]")) event.stopPropagation();
  });
  current.popup.addEventListener("click", event => {
    const button=event.target.closest("button");
    if (!button || button.disabled || active !== current) return;
    if (button.hasAttribute("data-date")) return chooseDate(current,button.dataset.date);
    if (button.hasAttribute("data-calendar-clear")) return commitValue(trigger,"");
    if (button.hasAttribute("data-calendar-today")) return chooseDate(current,dateKey(new Date()));
    if (button.hasAttribute("data-calendar-apply")) {
      const hour=current.popup.querySelector("[data-time-hour]"),minute=current.popup.querySelector("[data-time-minute]");
      if (!hour.checkValidity() || !minute.checkValidity() || hour.value === "" || minute.value === "") { (hour.checkValidity() ? minute : hour).reportValidity(); return; }
      const value=current.kind === "time" ? current.time : `${current.chosen || dateKey(current.view)}T${current.time}`;
      const candidate=trigger.cloneNode(false);
      candidate.value=value;
      if (!candidate.checkValidity()) {
        let message=current.popup.querySelector("[data-time-error]");
        if (!message) {message=document.createElement("p");message.setAttribute("data-time-error","");message.setAttribute("role","alert");current.popup.append(message);}
        message.textContent="所选时间不符合此字段允许的范围或间隔，请调整后重试。";
        return;
      }
      return commitValue(trigger,value);
    }
    if (button.hasAttribute("data-calendar-mode")) current.mode=current.mode === "days" ? "months" : current.mode === "months" ? "years" : "days";
    if (button.hasAttribute("data-calendar-nav")) {
      const step=Number(button.dataset.calendarNav);
      current.view=current.mode === "days" ? new Date(current.view.getFullYear(),current.view.getMonth()+step,1,12) : new Date(current.view.getFullYear()+step*(current.mode === "years" ? 12 : 1),current.view.getMonth(),1,12);
    }
    if (button.hasAttribute("data-calendar-choice")) {
      const value=Number(button.dataset.calendarChoice);
      current.view=current.mode === "months" ? new Date(current.view.getFullYear(),value,1,12) : new Date(value,current.view.getMonth(),1,12);
      current.mode=current.mode === "months" ? "days" : "months";
    }
    renderCalendar();
    current.popup.querySelector("[data-calendar-mode]")?.focus({preventScroll:true});
  });
  renderCalendar();
  (current.popup.querySelector('[data-date][tabindex="0"]') || current.popup.querySelector("[data-time-hour]"))?.focus({preventScroll:true});
}
function controlFor(target) {
  if (!(target instanceof Element) || target.closest(".themed-control-popup") || !document.querySelector(".shell")) return null;
  const field=target.closest('select:not([multiple]),input[type="date"],input[type="datetime-local"],input[type="time"]');
  if (!field || field.disabled || field.matches(":disabled") || field.readOnly || (field.tagName === "SELECT" && field.size > 1)) return null;
  return field;
}
function openControl(field) { field.tagName === "SELECT" ? openSelect(field) : openCalendar(field); }
export function initThemedControls() {
  if (initialized) return;
  initialized=true;
  document.addEventListener("pointerdown",event=>{
    if (event.button !== 0 || active?.popup.contains(event.target)) return;
    const field=controlFor(event.target);
    if (field) {
      event.preventDefault();
      if (active?.trigger === field) closeChooser(true);
      else { field.focus({preventScroll:true}); openControl(field); }
    } else closeChooser();
  },true);
  document.addEventListener("click",event=>{ if (controlFor(event.target)) event.preventDefault(); },true);
  document.addEventListener("keydown",event=>{
    if (active && (active.popup.contains(event.target) || active.trigger === event.target)) {
      if (event.key === "Escape") {event.preventDefault();event.stopPropagation();closeChooser(true);return;}
      if (event.key === "Tab") {
        if (active.kind === "select") { closeChooser(true); return; }
        const stops = [...active.popup.querySelectorAll("button,input,select,textarea,[tabindex]")]
          .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
        const index = stops.indexOf(document.activeElement);
        // Move through the calendar and time controls; leave the non-modal popup at its boundary.
        if (index < 0 || (event.shiftKey ? index === 0 : index === stops.length - 1)) closeChooser(true);
        return;
      }
      if (active.kind !== "select" && event.key === "Enter" && event.target.matches("[data-time-hour],[data-time-minute]")) {
        event.preventDefault();event.stopPropagation();active.popup.querySelector("[data-calendar-apply]")?.click();return;
      }
      if (active.kind === "select") {
        const buttons=[...active.popup.querySelectorAll("[data-option]:not(:disabled)")];
        const index=buttons.indexOf(document.activeElement);
        let next;
        if (event.key === "ArrowDown") next=(index+1)%buttons.length;
        if (event.key === "ArrowUp") next=(index-1+buttons.length)%buttons.length;
        if (event.key === "Home") next=0;
        if (event.key === "End") next=buttons.length-1;
        if (next !== undefined) {event.preventDefault();buttons[next]?.focus({preventScroll:true});buttons[next]?.scrollIntoView({block:"nearest"});return;}
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") {
          event.preventDefault();clearTimeout(searchTimer);search+=event.key.toLocaleLowerCase();searchTimer=setTimeout(()=>{search="";},600);
          buttons.find(button=>button.textContent.trim().toLocaleLowerCase().startsWith(search))?.focus({preventScroll:true});
        }
      } else if (event.target.matches("[data-date]") && ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key)) {
        event.preventDefault();
        const date=parseLocalDate(event.target.dataset.date);
        const offsets={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-((date.getDay()+6)%7),End:6-((date.getDay()+6)%7)};
        if (event.key === "PageUp" || event.key === "PageDown") {
          const originalDay=date.getDate(),delta=event.key === "PageUp" ? -1 : 1;
          date.setDate(1);date.setMonth(date.getMonth()+delta);
          date.setDate(Math.min(originalDay,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
        } else date.setDate(date.getDate()+offsets[event.key]);
        const direction=["ArrowLeft","ArrowUp","Home","PageUp"].includes(event.key) ? -1 : 1;
        for (let attempts=0;attempts<366 && !validDate(active.trigger,dateKey(date));attempts++) {
          const key=dateKey(date),min=active.trigger.min?.slice(0,10),max=active.trigger.max?.slice(0,10);
          if ((min && key<min) || (max && key>max)) return;
          date.setDate(date.getDate()+direction);
        }
        if (!validDate(active.trigger,dateKey(date))) return;
        active.view=date;renderCalendar();focusDate(dateKey(date));
      }
      return;
    }
    const field=controlFor(event.target);
    if (field && ((field.tagName === "SELECT" && [" ","Enter","ArrowDown","ArrowUp"].includes(event.key)) || (event.altKey && event.key === "ArrowDown") || event.key === "F4")) {
      event.preventDefault();event.stopPropagation();openControl(field);
    }
  },true);
  document.addEventListener("scroll",event=>{ if (active && !active.popup.contains(event.target)) closeChooser(); },true);
  window.addEventListener("resize",()=>closeChooser());
  window.addEventListener("blur",()=>closeChooser());
  new MutationObserver(()=>{if(active && !active.trigger.isConnected)closeChooser();}).observe(document.body,{childList:true,subtree:true});
}
if (typeof document !== "undefined") initThemedControls();
