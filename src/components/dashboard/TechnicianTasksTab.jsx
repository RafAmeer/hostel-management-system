import { formatDateTime } from "../../lib/formatters";
import { useState } from "react";
import ComplaintPhoto from "./ComplaintPhoto";

const STATUS_FLOW = { pending: "in_progress", in_progress: "completed" };
const STATUS_LABELS = { pending: "Pending", in_progress: "In Progress", completed: "Completed" };
const STATUS_TONE = { pending: "neutral", in_progress: "warn", completed: "ok" };
const NEXT_LABEL = { pending: "Start Work", in_progress: "Mark Completed" };

// "View assigned maintenance requests" / "update status (Pending, In
// Progress, Completed)" / "add remarks" from the proposal's Technician
// Module. Each request shows category, description, location (hostel +
// room) and the photo the student uploaded, per the proposal's field list.
function TechnicianTasksTab({ tasks, onAdvanceStatus, onAddRemark }) {
  const [draftRemark, setDraftRemark] = useState({});

  // Clear the box only once the remark is really saved, so nothing typed is
  // lost when the save fails.
  const submitRemark = async (id) => {
    const text = (draftRemark[id] ?? "").trim();
    if (!text) return;
    const ok = await onAddRemark(id, text);
    if (ok) setDraftRemark((prev) => ({ ...prev, [id]: "" }));
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Assigned Maintenance Requests</h2>

      {tasks.length === 0 ? (
        <p className="tab__empty">No maintenance requests assigned to you.</p>
      ) : (
        <div className="list">
          {tasks.map((t) => (
            <div key={t.id} className="glass-panel list-item-block">
              <p className="list-row__title">
                {t.category} &middot; {t.hostel ? `${t.hostel}, ` : ""}Room {t.room_number ?? "—"}
              </p>
              <p className="list-row__meta">{t.description}</p>
              <p className="list-row__meta">Reported by {t.student_name} &middot; {formatDateTime(t.created_at)}</p>
              <ComplaintPhoto url={t.photo_url} label={`Photo for ${t.category} request`} />

              <div className="list-row__actions" style={{ marginTop: "0.5rem" }}>
                <span className={"badge badge--" + (STATUS_TONE[t.status] ?? "neutral")}>
                  {STATUS_LABELS[t.status] ?? t.status}
                </span>
                {STATUS_FLOW[t.status] && (
                  <button className="primary-btn btn-sm" onClick={() => onAdvanceStatus(t.id)}>
                    {NEXT_LABEL[t.status]}
                  </button>
                )}
              </div>

              {t.remarks?.length > 0 && (
                <ul className="tech-remarks">
                  {t.remarks.map((r, i) => (
                    <li key={i} className="tech-remarks__item">
                      {r}
                    </li>
                  ))}
                </ul>
              )}

              <div className="ai-chat__form" style={{ marginTop: "0.6rem" }}>
                <input
                  type="text"
                  className="ai-chat__input"
                  placeholder="Add a remark on progress or completed work…"
                  value={draftRemark[t.id] ?? ""}
                  onChange={(e) => setDraftRemark((prev) => ({ ...prev, [t.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="primary-btn btn-sm"
                  onClick={() => submitRemark(t.id)}
                  disabled={!(draftRemark[t.id] ?? "").trim()}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TechnicianTasksTab;
