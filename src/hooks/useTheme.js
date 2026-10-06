import { useSyncExternalStore } from "react";

// Light / dark mode for the signed-in screens. Stored in localStorage and
// mirrored onto <html data-theme="…"> so CSS can switch every colour token
// at once. The inline script in index.html sets the attribute before first
// paint, so there's no flash of the wrong theme on load.
const KEY = "dormsphere_theme";
const listeners = new Set();

function read() {
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* storage unavailable — fall through */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

let current = typeof window === "undefined" ? "dark" : read();
if (typeof document !== "undefined") document.documentElement.dataset.theme = current;

function set(next) {
  current = next;
  document.documentElement.dataset.theme = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "light" ? "#dedcd3" : "#14191e");
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => "dark"
  );
  return { theme, toggle: () => set(theme === "light" ? "dark" : "light") };
}
