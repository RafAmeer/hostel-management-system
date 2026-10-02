import { useCallback, useEffect, useRef, useState } from "react";

// Signs the user out after a period with no activity.
//
//   idleMs   — how long without input before the warning appears
//   warnMs   — how long the warning counts down before sign-out
//
// Uses timestamps (not a single long setTimeout) so a phone that was
// locked or a laptop that slept still signs out correctly the moment the
// tab wakes up, and the last-activity time is shared across tabs through
// localStorage so working in one tab keeps the others alive.
const ACTIVITY_KEY = "dormsphere_last_activity";
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useIdleTimeout({ enabled, idleMs, warnMs, onTimeout }) {
  const [secondsLeft, setSecondsLeft] = useState(null); // null = not warning
  const lastActivity = useRef(0); // set by touch() when the hook enables
  const timedOut = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const touch = useCallback(() => {
    const now = Date.now();
    lastActivity.current = now;
    try {
      window.localStorage.setItem(ACTIVITY_KEY, String(now));
    } catch {
      /* ignore */
    }
  }, []);

  const stayActive = useCallback(() => {
    touch();
    setSecondsLeft(null);
  }, [touch]);

  useEffect(() => {
    if (!enabled) return undefined;
    timedOut.current = false;
    touch();

    // Once the warning is up, ordinary movement must NOT silently dismiss
    // it — the person has to press "Stay signed in".
    const onActivity = () => {
      if (Date.now() - lastActivity.current < idleMs) touch();
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    const onStorage = (e) => {
      if (e.key === ACTIVITY_KEY && e.newValue) {
        lastActivity.current = Number(e.newValue);
        setSecondsLeft(null);
      }
    };
    window.addEventListener("storage", onStorage);

    const tick = () => {
      if (timedOut.current) return;
      const idle = Date.now() - lastActivity.current;
      if (idle >= idleMs + warnMs) {
        timedOut.current = true;
        setSecondsLeft(null);
        onTimeoutRef.current?.();
      } else if (idle >= idleMs) {
        setSecondsLeft(Math.ceil((idleMs + warnMs - idle) / 1000));
      } else {
        setSecondsLeft(null);
      }
    };
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("storage", onStorage);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [enabled, idleMs, warnMs, touch]);

  return { secondsLeft, stayActive };
}
