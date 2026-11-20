import { useCallback, useSyncExternalStore } from "react";

// Lets any screen offer an "Install app" button.
//  - Android / desktop Chrome & Edge: the browser fires `beforeinstallprompt`;
//    we keep it and call it when the user taps the button.
//  - iPhone / iPad Safari never fires that event, so we report `showIosHint`
//    and the UI shows the Share -> "Add to Home Screen" steps instead.
//
// The browser fires `beforeinstallprompt` only ONCE, early on. It is caught
// here at module level (not inside a component) so the sign-in page and the
// student Home banner can both use it, even though Home mounts much later.
let deferredPrompt = null;
let installed = false;
let version = 0;
const listeners = new Set();

const emit = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    emit();
  });
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getSnapshot = () => version;

export function usePwaInstall() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);

  const install = useCallback(async () => {
    const prompt = deferredPrompt;
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPrompt = null;
    emit();
    return outcome === "accepted";
  }, []);

  return {
    canInstall: Boolean(deferredPrompt) && !isStandalone && !installed,
    showIosHint: isIos && !isStandalone && !installed,
    isStandalone,
    install,
  };
}
