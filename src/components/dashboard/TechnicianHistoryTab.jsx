// "View maintenance request history" from the proposal's Technician
// Module — completed requests only, read-only.
function TechnicianHistoryTab({ tasks }) {
  const completed = tasks.filter((t) => t.status === "completed");

  return (
    <div className="tab">
      <h2 className="tab__title">Completed Work History</h2>

      {completed.length === 0 ? (
        <p className="tab__empty">No completed maintenance requests yet.</p>
      ) : (
        <div className="list">
          {completed.map((t) => (
            <div key={t.id} className="list-row">
              <div>
                <p className="list-row__title">
                  {t.category} &middot; {t.hostel ? `${t.hostel}, ` : ""}Room {t.room_number ?? "—"}
                </p>
                <p className="list-row__meta">{t.description}</p>
                {t.remarks?.length > 0 && (
                  <p className="list-row__meta">Remarks: {t.remarks.join(" · ")}</p>
                )}
              </div>
              <div className="list-row__actions">
                <span className="badge badge--ok">Completed</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TechnicianHistoryTab;
