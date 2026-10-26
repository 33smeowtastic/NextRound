/** Remove only superseded script history; current text and question history stay intact. */
import { normalizeState } from "./core.js";

function scriptSnapshots(state) {
  const scripts = Array.isArray(state?.scripts) ? [...state.scripts] : [];
  const addConflicts = (conflicts) => {
    if (Array.isArray(conflicts))
      for (const conflict of conflicts)
        if (conflict?.collection === "scripts" && conflict.incoming && typeof conflict.incoming === "object" && !Array.isArray(conflict.incoming)) scripts.push(conflict.incoming);
  };
  addConflicts(state?.conflicts);
  if (Array.isArray(state?.trash))
    for (const entry of state.trash) {
      for (const field of ["records", "dependencies"])
        if (Array.isArray(entry?.[field]?.scripts)) scripts.push(...entry[field].scripts);
      addConflicts(entry?.conflicts);
    }
  return scripts;
}
export function hasScriptHistory(state) {
  return scriptSnapshots(state).some((script) => Array.isArray(script?.history) && script.history.length > 0);
}
export function stripScriptHistory(state) {
  const next = normalizeState(state);
  for (const script of scriptSnapshots(next))
    if (script && typeof script === "object" && Object.hasOwn(script, "history")) script.history = [];
  return next;
}
