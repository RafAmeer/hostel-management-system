// "Phone only" check for the curfew scan. Looks at the user-agent first
// (phones, and iPadOS which pretends to be a Mac but has a touchscreen),
// then falls back to "touch screen + small viewport". A desktop browser
// with the window shrunk does NOT count: it has no touch points.
//
// For testing on a laptop during development only, open the app with
// ?mobile=1 (ignored in production builds).
export function isPhoneDevice() {
  if (typeof navigator === "undefined") return false;

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("mobile") === "1") {
    return true;
  }

  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPod|Mobile|Windows Phone/i.test(ua)) return true;

  const touch = (navigator.maxTouchPoints || 0) > 1;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  // iPadOS reports a Mac user-agent; tablets are fine for scanning.
  return touch && coarse && Math.min(window.screen.width, window.screen.height) <= 1024;
}
