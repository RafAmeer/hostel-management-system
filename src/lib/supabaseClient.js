import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The login session lives in sessionStorage, not localStorage: closing the
// tab or browser ends the session, so the next visit starts at the login
// page. (A refresh keeps you signed in.) Leaving the site open but unused
// is handled separately by useAwayLogout and useIdleTimeout in App.jsx.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
