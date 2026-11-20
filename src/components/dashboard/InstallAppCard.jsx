import { useState } from "react";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { DownloadIcon } from "./icons";

const STORAGE_KEY = "dormsphere_install_card_dismissed";

function wasDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// Student feedback: half the testers never installed DormSphere, and most of
// those "did not know I could". The only install button was a small one on
// the sign-in page, so this repeats the offer on Home, where students land
// after signing in. It hides itself once the app is installed (or opened
// from the home screen), and "Not now" is remembered on this device.
function InstallAppCard() {
  const { canInstall, showIosHint, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (dismissed || (!canInstall && !showIosHint)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode: the card just comes back next visit */
    }
  };

  return (
    <div className="finance-notice install-card" role="status">
      <span aria-hidden="true">📲</span>
      <div className="install-card__body">
        <p className="finance-notice__title">Add DormSphere to your home screen</p>
        {canInstall ? (
          <p className="finance-notice__text">
            Open it like a normal app — no typing the link, and curfew scans are one tap away.
          </p>
        ) : (
          <p className="finance-notice__text">
            On iPhone: tap the <strong>Share</strong> button in Safari, then <strong>Add to Home Screen</strong>. It
            then opens like a normal app.
          </p>
        )}
        <div className="install-card__actions">
          {canInstall && (
            <button type="button" className="primary-btn" onClick={install}>
              <DownloadIcon aria-hidden="true" /> Install app
            </button>
          )}
          <button type="button" className="link-btn" onClick={dismiss}>
            {canInstall ? "Not now" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallAppCard;
