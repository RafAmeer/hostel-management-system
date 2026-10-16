import { useEffect, useState } from "react";
import { FingerprintIcon } from "./dashboard/icons";
import { listPasskeys, passkeysSupported, registerPasskey } from "../lib/passkeys";

// One-time, optional offer shown right after someone signs in to their new
// account: "use fingerprint / face next time?". Fingerprint/face sign-in can
// only be set up while signed in (there has to be an account to attach the
// passkey to), so this is the natural moment to ask. "Not now" is
// remembered per account; it can always be turned on later in Profile.
const dismissedKey = (userId) => `dormsphere_biometric_prompt_${userId}`;

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  return "This device";
}

function BiometricPrompt({ userId, onDone }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId || !passkeysSupported()) return undefined;
    try {
      if (window.localStorage.getItem(dismissedKey(userId))) return undefined;
    } catch {
      return undefined;
    }
    let cancelled = false;
    // Wait a moment so it doesn't land on top of the "Signed in" toast, and
    // only ask people who don't have a passkey yet.
    const t = setTimeout(async () => {
      try {
        const keys = await listPasskeys();
        if (!cancelled && keys.length === 0) setOpen(true);
      } catch {
        /* can't tell — don't nag */
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [userId]);

  if (!open) return null;

  const remember = () => {
    try {
      window.localStorage.setItem(dismissedKey(userId), "1");
    } catch {
      /* ignore */
    }
  };

  const notNow = () => {
    remember();
    setOpen(false);
  };

  const enable = async () => {
    setBusy(true);
    setError("");
    try {
      await registerPasskey(deviceName());
      remember();
      setOpen(false);
      onDone?.("Fingerprint / face sign-in is on.");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="timeout-backdrop" role="dialog" aria-modal="true" aria-labelledby="bio-title">
      <div className="timeout-modal">
        <h2 id="bio-title" className="timeout-modal__title">
          Sign in faster next time?
        </h2>
        <p className="timeout-modal__text">
          Use this device's fingerprint, face or screen lock instead of typing your password. It's optional, and you
          can change it any time in Profile.
        </p>
        {error && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}
        <div className="timeout-modal__actions">
          <button type="button" className="primary-btn" onClick={enable} disabled={busy} autoFocus>
            <FingerprintIcon aria-hidden="true" /> {busy ? "Waiting for your device…" : "Turn on fingerprint / face"}
          </button>
          <button type="button" className="link-btn" onClick={notNow} disabled={busy}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default BiometricPrompt;
