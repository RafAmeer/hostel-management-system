import { useCallback, useState } from "react";

// "Clear history" for the lists a person sees about themselves (curfew
// scans, finished complaints, old booking requests, completed repairs).
//
// Clearing only HIDES those entries from that person's own view — it never
// deletes a row, because the warden's records, reports and graphs are built
// from the same rows. The ids of the cleared entries are remembered per
// account and per list in this browser's localStorage, so anything that
// happens afterwards (a new scan, a complaint that gets completed later)
// still shows up, and "Show cleared" brings everything back.
const storageKey = (scope, userId) => `dormsphere_history_cleared_${scope}_${userId}`;
const MAX_IDS = 2000;

function read(scope, userId) {
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey(scope, userId)) ?? "[]");
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

function write(scope, userId, ids) {
  try {
    window.localStorage.setItem(storageKey(scope, userId), JSON.stringify(ids.slice(-MAX_IDS)));
  } catch {
    /* storage blocked: still hides for this visit */
  }
}

export function useClearedHistory(scope, userId) {
  const [ids, setIds] = useState(() => read(scope, userId));
  const [showAll, setShowAll] = useState(false);

  // Hides the given items (the ones that are currently clearable).
  const clear = useCallback(
    (items) => {
      const next = [...new Set([...ids, ...items.map((i) => String(i.id))])];
      write(scope, userId, next);
      setIds(next);
      setShowAll(false);
    },
    [ids, scope, userId]
  );

  const toggleShowAll = useCallback(() => setShowAll((v) => !v), []);

  // `canHide(item)` lets a list keep entries that are still live (e.g. an
  // unfinished complaint). Returns what to render, how many are hidden and
  // which visible items a "Clear" would hide.
  const view = (items, canHide = () => true) => {
    const cleared = new Set(ids);
    const hiddenItems = items.filter((i) => cleared.has(String(i.id)));
    const shown = showAll ? items : items.filter((i) => !cleared.has(String(i.id)));
    return {
      shown,
      hidden: hiddenItems.length,
      clearable: shown.filter((i) => !cleared.has(String(i.id)) && canHide(i)),
    };
  };

  return { showAll, clear, toggleShowAll, view };
}
