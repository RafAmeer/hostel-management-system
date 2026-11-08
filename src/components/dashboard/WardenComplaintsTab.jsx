import { useMemo, useState } from "react";
import ComplaintPhoto from "./ComplaintPhoto";

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

// A complaint still open after this many days is flagged as "unresolved"
// (and raises a warden notification — see lib/notifications.js).
const UNRESOLVED_AFTER_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "urgent", label: "Urgent" },
  { key: "unassigned", label: "Unassigned" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Resolved" },
  { key: "all", label: "All" },
];

function statusTone(status) {
  if (status === "completed") return "ok";
  if (status === "in_progress") return "warn";
  return "neutral";
}

const daysOpen = (c) => Math.floor((Date.now() - new Date(c.created_at).getTime()) / DAY);
const isUrgent = (c) => c.priority === "urgent";

// technicianName looks up display names from the `technicians` list (passed
// down from WardenDashboard, sourced from profiles where role='technician')
// so a complaint's `assigned_technician` (a user id) shows as a name.
function technicianName(id, technicians) {
  if (!id) return null;
  return technicians.find((t) => t.id === id)?.full_name ?? "Unknown technician";
}

function AssignRow({ complaint, technicians, onAssign }) {
  const [selectedId, setSelectedId] = useState(complaint.assigned_technician ?? "");

  return (
    <div className="assign-row">
      <select
        className="assign-row__select"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        aria-label={`Technician for ${complaint.category} complaint`}
      >
        <option value="" disabled>
          Choose technician…
        </option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name ?? t.id}
          </option>
        ))}
      </select>
      <button
        className="primary-btn btn-sm"
        disabled={!selectedId}
        title={selectedId ? "Assign this technician" : "Choose a technician first"}
        onClick={() => onAssign(complaint.id, selectedId)}
      >
        Assign
      </button>
    </div>
  );
}

// Complaint tracking (warden feedback): filter by state, see how long each
// one has been open, which technician has it, the technician's latest
// remark, and urgent / overdue flags at a glance.
function WardenComplaintsTab({ complaints, technicians, onAssign, onComplete }) {
  const [filter, setFilter] = useState("open");

  const counts = useMemo(() => {
    const open = complaints.filter((c) => c.status !== "completed");
    return {
      open: open.length,
      urgent: open.filter(isUrgent).length,
      unassigned: complaints.filter((c) => c.status === "pending" && !c.assigned_technician).length,
      in_progress: complaints.filter((c) => c.status === "in_progress").length,
      completed: complaints.filter((c) => c.status === "completed").length,
      all: complaints.length,
      stale: open.filter((c) => daysOpen(c) >= UNRESOLVED_AFTER_DAYS).length,
    };
  }, [complaints]);

  const shown = useMemo(() => {
    const list = complaints.filter((c) => {
      if (filter === "open") return c.status !== "completed";
      if (filter === "urgent") return c.status !== "completed" && isUrgent(c);
      if (filter === "unassigned") return c.status === "pending" && !c.assigned_technician;
      if (filter === "in_progress") return c.status === "in_progress";
      if (filter === "completed") return c.status === "completed";
      return true;
    });
    // Urgent first, then oldest open first, so nothing sits at the bottom.
    return [...list].sort((a, b) => {
      if (isUrgent(a) !== isUrgent(b)) return isUrgent(a) ? -1 : 1;
      if (filter === "completed" || filter === "all") return new Date(b.created_at) - new Date(a.created_at);
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }, [complaints, filter]);

  return (
    <div className="tab">
      <h2 className="tab__title">Complaints</h2>

      <div className="stat-mini-row">
        <div className="stat-mini">
          <strong>{counts.open}</strong>
          <span>Open</span>
        </div>
        <div className={"stat-mini" + (counts.urgent ? " stat-mini--danger" : "")}>
          <strong>{counts.urgent}</strong>
          <span>Urgent</span>
        </div>
        <div className={"stat-mini" + (counts.stale ? " stat-mini--warn" : "")}>
          <strong>{counts.stale}</strong>
          <span>Open {UNRESOLVED_AFTER_DAYS}+ days</span>
        </div>
        <div className="stat-mini">
          <strong>{counts.completed}</strong>
          <span>Resolved</span>
        </div>
      </div>

      <div className="filter-chips" role="tablist" aria-label="Filter complaints">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={"filter-chip" + (filter === f.key ? " filter-chip--active" : "")}
            onClick={() => setFilter(f.key)}
          >
            {f.label} <span className="filter-chip__count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="tab__empty">{complaints.length === 0 ? "No complaints reported." : "Nothing in this list."}</p>
      ) : (
        <div className="list">
          {shown.map((c) => {
            const age = daysOpen(c);
            const stale = c.status !== "completed" && age >= UNRESOLVED_AFTER_DAYS;
            return (
              <div key={c.id} className={"list-row list-row--wrap" + (isUrgent(c) && c.status !== "completed" ? " list-row--urgent" : "")}>
                <div>
                  <p className="list-row__title">
                    {isUrgent(c) && <span className="announcement__urgent">Urgent</span>}
                    {c.student_name} &middot; {c.category}
                  </p>
                  <p className="list-row__meta">
                    {[c.hostel, c.room_number].filter(Boolean).join(" · ") || "No location given"} &middot;{" "}
                    {c.description}
                  </p>
                  <p className="list-row__meta">
                    Reported {new Date(c.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                    {c.status !== "completed" && (
                      <>
                        {" · "}
                        <span className={stale ? "text-danger" : ""}>
                          open {age === 0 ? "today" : `${age} day${age > 1 ? "s" : ""}`}
                        </span>
                      </>
                    )}
                  </p>
                  {c.assigned_technician && (
                    <p className="list-row__meta">
                      Assigned to {technicianName(c.assigned_technician, technicians)}
                    </p>
                  )}
                  {Array.isArray(c.remarks) && c.remarks.length > 0 && (
                    <p className="list-row__meta">Latest technician update: {c.remarks[c.remarks.length - 1]}</p>
                  )}
                  <ComplaintPhoto url={c.photo_url} label={`Photo for ${c.category} complaint`} />
                </div>

                <div className="list-row__actions">
                  <span className={"badge badge--" + statusTone(c.status)}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  {c.status === "pending" &&
                    (technicians.length > 0 ? (
                      <AssignRow complaint={c} technicians={technicians} onAssign={onAssign} />
                    ) : (
                      <span className="list-row__meta">No technicians registered yet</span>
                    ))}
                  {c.status === "in_progress" && (
                    <button className="primary-btn btn-sm" onClick={() => onComplete(c.id)}>
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WardenComplaintsTab;
