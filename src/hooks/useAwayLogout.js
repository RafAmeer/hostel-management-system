import { useEffect, useRef } from "react";

// Signs the user out when they leave the site: if the tab/app stays hidden
// (switched to another app or tab, screen locked) for longer than `awayMs`,
// onTimeout runs. Uses timestamps, so it still fires correctly when a phone
// freezes the page in the background. Closing the tab/browser is handled by
// the session itself living in sessionStorage (see supabaseClient.js).
export function useAwayLogout({ enabled, awayMs, onTimeout }) {
  const hiddenAt = useRef(null);
  const cb = useRef(onTimeout);
  useEffect(() => {
    cb.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return undefined;
    hiddenAt.current = null;

    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const left = hiddenAt.current;
      hiddenAt.current = null;
      if (left && Date.now() - left >= awayMs) cb.current?.();
    };

    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [enabled, awayMs]);
}
