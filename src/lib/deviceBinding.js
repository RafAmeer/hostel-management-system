import { supabase } from "./supabaseClient";
import { isPhoneDevice } from "./device";

// Curfew scanning is tied to ONE phone per student, and one student per
// phone. The first time a student logs in to DormSphere on a phone, a random
// device_token is saved in that phone's localStorage and recorded in
// `device_bindings` (through the bind_device() database function, see
// supabase/migrations/2026-10-08_transport_booking_rules_device.sql).
//
//  - A phone that already belongs to student A will NOT be re-bound when
//    student B logs in on it (so one phone can't be used to scan for
//    several people).
//  - A student who logs in on a new phone moves their binding there; the
//    old phone stops working for scans (so an account isn't "synced" on
//    two devices at once).
//  - Only phones are bound — logging in on a laptop never touches it.
//
// Honest limit: a website cannot read a phone's hardware ID. If someone
// clears the browser's site data or uses a private tab, the phone looks
// new and can be bound again by whoever logs in. The one-phone-per-student
// rule and the GPS check on every scan keep that from being useful.
export const DEVICE_TOKEN_KEY = "dormsphere_curfew_device_token";
export const DEVICE_USER_KEY = "dormsphere_curfew_device_user";

export function getDeviceToken() {
  try {
    return window.localStorage.getItem(DEVICE_TOKEN_KEY);
  } catch {
    return null;
  }
}

// "mine" | "other" | "none" — who this phone is registered to, as far as
// this phone's own storage knows.
export function getDeviceOwnership(userId) {
  try {
    const token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) return "none";
    const owner = window.localStorage.getItem(DEVICE_USER_KEY);
    if (!owner || owner === userId) return "mine";
    return "other";
  } catch {
    return "none";
  }
}

function missingFunction(error) {
  return error && (error.code === "PGRST202" || error.code === "42883" || /bind_device/.test(error.message ?? ""));
}

// Call while a student is signed in. Resolves to
// { status: "ok" | "owned_by_other" | "not_phone" | "unavailable" }.
export async function ensureDeviceBinding(userId) {
  if (!userId) return { status: "unavailable" };
  if (!isPhoneDevice()) return { status: "not_phone" };

  try {
    const existing = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    const owner = window.localStorage.getItem(DEVICE_USER_KEY);

    // This phone is already stamped as someone else's: don't even ask.
    if (existing && owner && owner !== userId) return { status: "owned_by_other" };

    const token = existing || crypto.randomUUID();
    const label = navigator.userAgent.slice(0, 120);

    const { data, error } = await supabase.rpc("bind_device", { p_token: token, p_label: label });

    if (error) {
      if (!missingFunction(error)) return { status: "unavailable" };
      // The SQL migration hasn't been run yet: fall back to the old
      // direct insert so curfew keeps working (without the one-phone rule).
      if (existing) {
        window.localStorage.setItem(DEVICE_USER_KEY, userId);
        return { status: "ok" };
      }
      const { error: insertError } = await supabase
        .from("device_bindings")
        .insert({ student_id: userId, device_token: token, label });
      if (insertError) return { status: "unavailable" };
      window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
      window.localStorage.setItem(DEVICE_USER_KEY, userId);
      return { status: "ok" };
    }

    if (data === "device_owned_by_other") {
      // Keep the token the phone already has; just remember it isn't ours.
      return { status: "owned_by_other" };
    }

    window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
    window.localStorage.setItem(DEVICE_USER_KEY, userId);
    return { status: "ok" };
  } catch {
    return { status: "unavailable" };
  }
}

// The owner frees this phone (e.g. before handing it on, or after a reset).
export async function releaseDevice() {
  const token = getDeviceToken();
  if (token) {
    const { error } = await supabase.rpc("release_device", { p_token: token });
    if (error && !missingFunction(error)) return { ok: false, message: error.message };
  }
  try {
    window.localStorage.removeItem(DEVICE_TOKEN_KEY);
    window.localStorage.removeItem(DEVICE_USER_KEY);
  } catch {
    /* ignore */
  }
  return { ok: true };
}
