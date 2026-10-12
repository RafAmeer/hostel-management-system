import { useState } from "react";
import { formatDateTime } from "../../lib/formatters";
import HelpThread, { HELP_STATUS_LABELS, helpTone } from "./HelpThread";

const FILTERS = [
  { key: "open", label: "Waiting" },
  { key: "answered", label: "Answered" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

// Warden inbox for student help requests.
function WardenHelpTab({ tickets, students, onChanged }) {
  const [filter, setFilter] = useState("open");
  const [openId, setOpenId] = useState(null);

  const nameOf = (id) => students.find((s) => s.id === id)?.full_name ?? "Student";
  const open = tickets.find((t) => t.id === openId);

  if (open) {
    return (
      <HelpThread
        ticket={open}
        viewerRole="warden"
        studentName={nameOf(open.student_id)}
        onBack={() => setOpenId(null)}
        onChanged={onChanged}
      />
    );
  }

  const count = (key) => (key === "all" ? tickets.length : tickets.filter((t) => t.status === key).length);
  const shown = tickets.filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="tab">
      <h2 className="tab__title">Help Center</h2>
      <p className="tab__subtitle-text">Requests students have sent to you. Reply to answer; mark resolved when done.</p>

      <div className="day-tabs" role="tablist" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={"day-tabs__btn" + (filter === f.key ? " day-tabs__btn--active" : "")}
            onClick={() => setFilter(f.key)}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="tab__empty">{filter === "open" ? "Nothing waiting for you." : "No requests here."}</p>
      ) : (
        <div className="list">
          {shown.map((t) => (
            <button key={t.id} type="button" className="list-row list-row--button" onClick={() => setOpenId(t.id)}>
              <div>
                <p className="list-row__title">{t.subject}</p>
                <p className="list-row__meta">
                  {nameOf(t.student_id)} · {t.category} · {formatDateTime(t.updated_at ?? t.created_at)}
                </p>
              </div>
              <span className={"badge badge--" + helpTone(t.status)}>{HELP_STATUS_LABELS[t.status] ?? t.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default WardenHelpTab;
