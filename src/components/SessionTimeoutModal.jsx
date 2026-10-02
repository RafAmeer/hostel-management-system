// Shown for the last minute before an idle sign-out. Movement alone doesn't
// dismiss it — the person has to choose, so an unattended screen can't
// keep itself alive.
function SessionTimeoutModal({ secondsLeft, onStay, onLogout }) {
  if (secondsLeft == null) return null;
  return (
    <div className="timeout-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="timeout-title">
      <div className="timeout-modal">
        <h2 id="timeout-title" className="timeout-modal__title">
          Still there?
        </h2>
        <p className="timeout-modal__text">
          For your security you'll be signed out in{" "}
          <strong className="timeout-modal__count">{secondsLeft}s</strong> because of inactivity.
        </p>
        <div className="timeout-modal__actions">
          <button type="button" className="primary-btn" onClick={onStay} autoFocus>
            Stay signed in
          </button>
          <button type="button" className="link-btn" onClick={onLogout}>
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionTimeoutModal;
