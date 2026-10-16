import { useState } from "react";

// "Clear history" control shown above a history list. Two-step (Clear →
// Yes, clear) so a stray tap on a phone can't wipe the view, and a small
// "Show cleared" link to bring entries back.
function ClearHistoryButton({ canClear, hidden, showAll, onClear, onToggleShowAll, note }) {
  const [confirming, setConfirming] = useState(false);

  if (!canClear && hidden === 0) return null;

  return (
    <div className="history-clear">
      {confirming ? (
        <>
          <span className="list-row__meta">Clear this history from your view?</span>
          <button
            type="button"
            className="btn-outline btn-outline--danger"
            onClick={() => {
              onClear();
              setConfirming(false);
            }}
          >
            Yes, clear
          </button>
          <button type="button" className="btn-outline btn-outline--neutral" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          {canClear && (
            <button type="button" className="btn-outline btn-outline--neutral" onClick={() => setConfirming(true)}>
              Clear history
            </button>
          )}
          {hidden > 0 && (
            <button type="button" className="link-btn" onClick={onToggleShowAll}>
              {showAll ? "Hide cleared again" : `Show ${hidden} cleared`}
            </button>
          )}
        </>
      )}
      {note && <p className="list-row__meta history-clear__note">{note}</p>}
    </div>
  );
}

export default ClearHistoryButton;
