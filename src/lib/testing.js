// Multi-tab testing switch. Open the site once in a tab with ?testing=1
// (e.g. https://your-site.vercel.app/?testing=1) and that tab will NOT be
// signed out for sitting in the background — which is what happens to the
// "other" tab when you switch between two tabs to test two accounts.
// It is remembered for that tab only (sessionStorage) and is off for
// everyone else, so real users keep the leave-the-site logout.
const KEY = "dormsphere_testing";

export function isTestingTab() {
  try {
    if (new URLSearchParams(window.location.search).get("testing") === "1") {
      window.sessionStorage.setItem(KEY, "1");
    }
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
