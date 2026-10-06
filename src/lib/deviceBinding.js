import { supabase } from "./supabaseClient";

// Curfew scanning is tied to a phone that a student has already signed in on.
// The first time a student logs in to DormSphere on a phone, this creates a
// random device_token (saved in that phone's localStorage) and records it in
// `device_bindings`. The public /curfew page then identifies the student by
// that token alone. A phone that has never had a real login on it has no
// token, so it cannot scan.
export const DEVICE_TOKEN_KEY = "dormsphere_curfew_device_token";
const DEVICE_USER_KEY = "dormsphere_curfew_device_user";

export function getDeviceToken() {
  try {
    return window.localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Call while a student is signed in. Does nothing if this phone is already
// bound to this same student; creates a fresh binding if the phone is new
// or was last used by a different student.
export async function ensureDeviceBinding(userId) {
  if (!userId) return;
  try {
    const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    const boundUser = window.localStorage.getItem(DEVICE_USER_KEY);
    // Tokens created by the old /curfew login form have no owner stamp;
    // they are kept as they are (they already work server-side).
    if (existing && (!boundUser || boundUser === userId)) {
      if (!boundUser) window.localStorage.setItem(DEVICE_USER_KEY, userId);
      return;
    }

    const deviceToken = crypto.randomUUID();
    const { error } = await supabase.from("device_bindings").insert({
      student_id: userId,
      device_token: deviceToken,
      label: navigator.userAgent.slice(0, 120),
    });
    if (error) return; // best effort: the student can still use the dashboard
    window.localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
    window.localStorage.setItem(DEVICE_USER_KEY, userId);
  } catch {
    /* storage blocked — curfew just won't be available on this phone */
  }
}
