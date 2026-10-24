// Fingerprint sign-in using passkeys (WebAuthn).
// The phone's own biometric prompt unlocks a key that never leaves the
// device; the `passkey` Edge Function checks it server-side and then hands
// back a one-time sign-in token, so a password isn't needed.
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "./supabaseClient";
import { callFunction } from "./callFunction";

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

const call = (action, body = {}) => callFunction("passkey", { action, ...body });

function friendly(err) {
  if (err?.name === "NotAllowedError") return new Error("Cancelled, or your device couldn't verify you.");
  if (err?.name === "InvalidStateError") return new Error("This device already has a passkey for this account.");
  return err instanceof Error ? err : new Error("Something went wrong.");
}

// Must be called while signed in (from the profile page).
export async function registerPasskey(deviceName) {
  try {
    const options = await call("register-options");
    const response = await startRegistration({ optionsJSON: options });
    await call("register-verify", { response, device_name: deviceName });
  } catch (err) {
    throw friendly(err);
  }
}

// Signed-out biometric login. Resolves once a real session exists.
export async function loginWithPasskey() {
  try {
    const options = await call("login-options");
    const response = await startAuthentication({ optionsJSON: options });
    const { token_hash } = await call("login-verify", { response });
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
    if (error) throw error;
  } catch (err) {
    throw friendly(err);
  }
}

export async function listPasskeys() {
  const { data } = await supabase
    .from("passkeys")
    .select("id, device_name, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function removePasskey(id) {
  const { error } = await supabase.from("passkeys").delete().eq("id", id);
  if (error) throw error;
}
