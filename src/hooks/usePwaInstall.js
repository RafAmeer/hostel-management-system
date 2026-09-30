import { useCallback, useEffect, useState } from "react";

// Lets the login page offer an "Install app" button.
//  - Android / desktop Chrome & Edge: the browser fires `beforeinstallprompt`;
//    we keep it and call it when the user taps the button.
//  - iPhone / iPad Safari never fires that event, so we report `isIos` and the
//    UI shows the Share -> "Add to Home Screen" steps instead.
export function usePwaInstall() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(false);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  return {
    canInstall: Boolean(deferred) && !isStandalone && !installed,
    showIosHint: isIos && !isStandalone && !installed,
    install,
  };
}
