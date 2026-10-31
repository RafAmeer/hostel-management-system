// Fingerprint sign-in using passkeys (WebAuthn).
// The phone's own biometric prompt unlocks a key that never leaves the
// device; the `passkey` Edge Function checks it server-side and then hands
// back a one-time sign-in token, so a password isn't needed.
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { supabase } from "./supabaseClient";
import { callFunction } from "./callFunction";

export const passkeysSupported = () => typeof window !== "undefined" && browserSupportsWebAuthn();

const call = (action, body = {}) => callFunction("passkey", { action, ...body });

const rpId = () => window.location.hostname;
const toB64u = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// ---- WebAuthn Signal API ------------------------------------------------
// Deleting an account (or removing a passkey) only deletes OUR copy of the
// public key. The fingerprint entry saved on the phone / in the password
// manager stays behind and keeps being offered. These calls tell the phone's
// password manager to remove or hide those stale entries. Supported in
// Chrome/Edge (Google Password Manager) and Safari on recent iOS/macOS;
// elsewhere they quietly do nothing and we show manual steps instead.
const PKC = () => (typeof window !== "undefined" ? window.PublicKeyCredential : undefined);

export const canForgetStalePasskeys = () => typeof PKC()?.signalUnknownCredential === "function";

async function signalUnknown(credentialId) {
  if (!canForgetStalePasskeys() || !credentialId) return false;
  try {
    await PKC().signalUnknownCredential({ rpId: rpId(), credentialId });
    return true;
  } catch {
    return false;
  }
}

async function signalAccepted(userId, credentialIds) {
  if (typeof PKC()?.signalAllAcceptedCredentials !== "function" || !userId) return;
  try {
    await PKC().signalAllAcceptedCredentials({
      rpId: rpId(),
      userId: toB64u(userId),
      allAcceptedCredentialIds: credentialIds,
    });
  } catch {
    /* best effort */
  }
}

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
// If the phone offers a fingerprint whose account was deleted, the error has
// `unknownCredential: true` and `forgotten` says whether the phone was asked
// to remove it automatically.
export async function loginWithPasskey() {
  let result;
  try {
    const options = await call("login-options");
    const response = await startAuthentication({ optionsJSON: options });
    result = await call("login-verify", { response });
    const { error } = await supabase.auth.verifyOtp({ token_hash: result.token_hash, type: "magiclink" });
    if (error) throw error;
  } catch (err) {
    if (err?.code === "unknown_credential") {
      const forgotten = await signalUnknown(err.payload?.credential_id);
      const e = new Error(
        forgotten
          ? "That fingerprint was linked to a deleted account, so we've asked your device to forget it. Sign in with your email and password."
          : err.message
      );
      e.unknownCredential = true;
      e.forgotten = forgotten;
      throw e;
    }
    throw friendly(err);
  }
  // Keep the phone's saved list in step with ours (hides any passkeys for
  // this account that were removed in Profile).
  if (result?.user_handle) {
    const userId = new TextDecoder().decode(
      Uint8Array.from(atob(result.user_handle.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
    );
    signalAccepted(userId, result.credential_ids ?? []);
  }
}

export async function listPasskeys() {
  const { data } = await supabase
    .from("passkeys")
    .select("id, device_name, created_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

// Removes the passkey from DormSphere AND asks this device's password
// manager to drop it, so it stops showing up on the sign-in prompt.
export async function removePasskey(id) {
  const { error } = await supabase.from("passkeys").delete().eq("id", id);
  if (error) throw error;
  const forgotten = await signalUnknown(id);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const remaining = await listPasskeys();
    await signalAccepted(user.id, remaining.map((k) => k.id));
  }
  return { forgotten };
}
