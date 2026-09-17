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

function WardenComplaintsTab({ complaints, onAssign, onComplete }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Complaints</h2>

      {complaints.length === 0 ? (
        <p className="tab__empty">No complaints reported.</p>
      ) : (
        <div className="list">
          {complaints.map((c) => (
            <div key={c.id} className="list-row">
              <div>
                <p className="list-row__title">
                  {c.student_name} &middot; {c.category}
                </p>
                <p className="list-row__meta">
                  {c.room_number} &middot; {c.description}
                </p>
              </div>

              <div className="list-row__actions">
                <span className={"badge badge--" + statusTone(c.status)}>
                  {STATUS_LABELS[c.status] ?? c.status}
                </span>
                {c.status === "pending" && (
                  <button className="primary-btn btn-sm" onClick={() => onAssign(c.id)}>
                    Assign
                  </button>
                )}
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
