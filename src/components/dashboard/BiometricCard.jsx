import { useEffect, useState } from "react";
import { FingerprintIcon } from "./icons";
import { listPasskeys, passkeysSupported, registerPasskey, removePasskey } from "../../lib/passkeys";
import { formatDateTime } from "../../lib/formatters";

function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android phone";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  return "This device";
}

// Profile → "Fingerprint sign-in" settings.
function BiometricCard() {
  const [keys, setKeys] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", tone: "info" });

  const refresh = async () => {
    try {
      setKeys(await listPasskeys());
    } catch {
      setKeys([]);
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  if (!passkeysSupported()) {
    return (
      <section className="glass-panel biometric-card">
        <h3 className="panel-heading">Fingerprint sign-in</h3>
        <p className="list-row__meta">This browser doesn't support passkeys. Try Chrome, Safari or Edge on a phone or laptop with a fingerprint sensor.</p>
      </section>
    );
  }

  const enable = async () => {
    setBusy(true);
    setMsg({ text: "", tone: "info" });
    try {
      await registerPasskey(guessDeviceName());
      setMsg({ text: "Done. Next time use “Sign in with fingerprint” on the login page.", tone: "info" });
      await refresh();
    } catch (e) {
      setMsg({ text: e.message, tone: "error" });
    }
    setBusy(false);
  };

  const remove = async (id) => {
    try {
      const { forgotten } = await removePasskey(id);
      await refresh();
      setMsg({
        text: forgotten
          ? "Removed. Your device was also asked to forget this fingerprint."
          : "Removed from DormSphere. If this device still offers it at sign-in, delete the DormSphere passkey in your phone's password manager.",
        tone: "info",
      });
    } catch (e) {
      setMsg({ text: e.message, tone: "error" });
    }
  };

  return (
    <section className="glass-panel biometric-card">
      <h3 className="panel-heading">Fingerprint sign-in</h3>
      <p className="list-row__meta">
        Sign in with your fingerprint instead of typing your password. Your fingerprint
        never leaves the phone.
      </p>
      {msg.text && (
        <p className={"message message--" + msg.tone} role="status">
          {msg.text}
        </p>
      )}
      <button type="button" className="primary-btn" onClick={enable} disabled={busy}>
        <FingerprintIcon aria-hidden="true" /> {busy ? "Waiting for your device…" : "Enable on this device"}
      </button>
      {keys.length > 0 && (
        <ul className="biometric-list">
          {keys.map((k) => (
            <li key={k.id}>
              <span>
                {k.device_name || "Device"} <small>added {formatDateTime(k.created_at)}</small>
              </span>
              <button type="button" className="btn-outline" onClick={() => remove(k.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default BiometricCard;
