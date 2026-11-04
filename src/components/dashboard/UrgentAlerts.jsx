import { useState } from "react";

const SHOW_FOR_DAYS = 7;
const STORAGE_KEY = "dormsphere:dismissed-urgent";

function readDismissed() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// Red banner(s) at the very top of student Home for emergency announcements
// the warden posted in the last week. The student can dismiss one after
// reading it (remembered on this device only).
function UrgentAlerts({ announcements = [] }) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const [mountedAt] = useState(() => Date.now());

  const cutoff = mountedAt - SHOW_FOR_DAYS * 24 * 60 * 60 * 1000;
  const active = announcements.filter(
    (a) => a.priority === "urgent" && new Date(a.created_at).getTime() > cutoff && !dismissed.includes(a.id)
  );
  if (active.length === 0) return null;

  const dismiss = (id) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode: banner just comes back next visit */
    }
  };

  return (
    <div className="urgent-alerts">
      {active.map((a) => (
        <div key={a.id} className="urgent-alert" role="alert">
          <span className="urgent-alert__icon" aria-hidden="true">🚨</span>
          <div className="urgent-alert__text">
            <p className="urgent-alert__title">{a.title}</p>
            <p className="urgent-alert__body">{a.body}</p>
            <p className="urgent-alert__meta">
              Emergency notice from the hostel warden ·{" "}
              {new Date(a.created_at).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <button type="button" className="urgent-alert__close" onClick={() => dismiss(a.id)} aria-label="Dismiss alert">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

export default UrgentAlerts;
