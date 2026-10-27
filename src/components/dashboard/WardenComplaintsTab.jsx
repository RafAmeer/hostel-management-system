import { useState } from "react";

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

function statusTone(status) {
  if (status === "completed") return "ok";
  if (status === "in_progress") return "warn";
  return "neutral";
}

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

function WardenComplaintsTab({ complaints, technicians, onAssign, onComplete }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Complaints</h2>

      {complaints.length === 0 ? (
        <p className="tab__empty">No complaints reported.</p>
      ) : (
        <div className="list">
          {complaints.map((c) => (
            <div key={c.id} className="list-row list-row--wrap">
              <div>
                <p className="list-row__title">
                  {c.student_name} &middot; {c.category}
                </p>
                <p className="list-row__meta">
                  {[c.hostel, c.room_number].filter(Boolean).join(" · ") || "No location given"} &middot;{" "}
                  {c.description}
                </p>
                {Array.isArray(c.remarks) && c.remarks.length > 0 && (
                  <p className="list-row__meta">Technician remark: {c.remarks[c.remarks.length - 1]}</p>
                )}
                {c.assigned_technician && (
                  <p className="list-row__meta">
                    Assigned to {technicianName(c.assigned_technician, technicians)}
                  </p>
                )}
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
          ))}
        </div>
      )}
    </div>
  );
}

export default WardenComplaintsTab;
