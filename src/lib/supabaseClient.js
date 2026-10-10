import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Every browser tab gets its OWN login session.
//
// supabase-js announces each sign-in / sign-out to all other tabs through a
// BroadcastChannel named after the auth storage key, and the other tabs then
// switch to that session. With one shared key, logging in as a warden in
// tab 2 would flip tab 1 (a student) to the warden too. A per-tab key gives
// each tab its own channel and its own stored session, so two tabs can be
// two different accounts at once.
//
// The id lives in sessionStorage, so it survives a refresh of the same tab
// but is new for every new tab. (Chrome's "Duplicate tab" copies
// sessionStorage, so a duplicated tab shares the original's login — open a
// fresh tab or a private window instead.)
const TAB_ID_KEY = "dormsphere_tab_id";

function getTabId() {
  try {
    let id = window.sessionStorage.getItem(TAB_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem(TAB_ID_KEY, id);
    }
    return id;
  } catch {
    return "default";
  }
}

// The login session lives in sessionStorage, not localStorage: closing the
// tab or browser ends the session, so the next visit starts at the login
// page. (A refresh keeps you signed in.) Leaving the site open but unused
// is handled separately by useAwayLogout and useIdleTimeout in App.jsx.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    storageKey: typeof window !== "undefined" ? `dormsphere-auth-${getTabId()}` : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
