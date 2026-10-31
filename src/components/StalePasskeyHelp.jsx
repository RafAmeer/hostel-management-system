// "Fingerprint not working?" on the sign-in page.
//
// Deleting a DormSphere account (or removing a device in Profile) deletes
// the passkey on our side, but the copy saved on the phone stays in its
// password manager and keeps popping up. On supported browsers we already
// ask the phone to forget it automatically (lib/passkeys.js); these steps
// cover everything else.
const SITE = typeof window !== "undefined" ? window.location.hostname : "this site";

function StalePasskeyHelp({ open, forgotten, onToggle }) {
  return (
    <div className="stale-passkey">
      <button type="button" className="forgot-password-link" onClick={onToggle} aria-expanded={open}>
        {open ? "Hide fingerprint help" : "Fingerprint not working or linked to an old account?"}
      </button>
      {open && (
        <div className="stale-passkey__panel" role="region" aria-label="Remove an old fingerprint">
          <p>
            {forgotten
              ? "We've asked your device to forget the old fingerprint. If it still shows up, remove it manually:"
              : "An old fingerprint from a deleted account stays saved on your device until you remove it:"}
          </p>
          <ul>
            <li>
              <strong>Android:</strong> Settings → Google → Autofill → Google Password Manager → find{" "}
              <em>{SITE}</em> → Delete.
            </li>
            <li>
              <strong>iPhone:</strong> open the Passwords app (or Settings → Passwords) → find <em>{SITE}</em> →
              Delete passkey.
            </li>
            <li>
              <strong>Windows:</strong> Settings → Accounts → Passkeys → find <em>{SITE}</em> → ⋯ → Delete passkey.
            </li>
            <li>
              <strong>Samsung:</strong> Settings → Security and privacy → Samsung Pass → Passkeys → Delete.
            </li>
          </ul>
          <p>Then sign in with your email and password and turn fingerprint on again from your profile.</p>
        </div>
      )}
    </div>
  );
}

export default StalePasskeyHelp;
