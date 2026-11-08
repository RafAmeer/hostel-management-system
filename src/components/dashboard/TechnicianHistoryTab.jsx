import ClearHistoryButton from "./ClearHistoryButton";
import { useClearedHistory } from "../../lib/clearedHistory";
import ComplaintPhoto from "./ComplaintPhoto";

// "View maintenance request history" from the proposal's Technician
// Module — completed requests only, read-only.
function TechnicianHistoryTab({ tasks, userId }) {
  const all = tasks.filter((t) => t.status === "completed");
  const history = useClearedHistory("technician", userId);
  const { shown: completed, hidden, clearable } = history.view(all);

  return (
    <div className="tab">
      <h2 className="tab__title">Completed Work History</h2>

      <ClearHistoryButton
        canClear={clearable.length > 0}
        hidden={hidden}
        showAll={history.showAll}
        onClear={() => history.clear(clearable)}
        onToggleShowAll={history.toggleShowAll}
        note="Clearing only hides this list for you. The hostel keeps the repair records."
      />

      {completed.length === 0 ? (
        <p className="tab__empty">{all.length === 0 ? "No completed maintenance requests yet." : "History cleared."}</p>
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
                <ComplaintPhoto url={t.photo_url} label={`Photo for ${t.category} request`} />
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
