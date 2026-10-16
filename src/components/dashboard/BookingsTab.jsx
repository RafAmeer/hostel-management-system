import { formatDateTime } from "../../lib/formatters";
import ClearHistoryButton from "./ClearHistoryButton";
import { useClearedHistory } from "../../lib/clearedHistory";

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function statusTone(status) {
  if (status === "approved") return "ok";
  if (status === "rejected") return "danger";
  return "warn";
}

// Shows every booking request the student has made, newest first (matches
// the order `loadAll` in StudentDashboard already fetches them in), each
// tagged with where it's at in the warden's approval flow.
function BookingsTab({ bookings, userId }) {
  const history = useClearedHistory("bookings", userId);
  // Rejected / cancelled requests can be cleared; pending and approved ones
  // are still relevant, so they always stay.
  const finished = (b) => b.status === "rejected" || b.status === "cancelled";
  const { shown, hidden, clearable } = history.view(bookings, finished);

  return (
    <div className="tab">
      <h2 className="tab__title">Status</h2>

      <ClearHistoryButton
        canClear={clearable.length > 0}
        hidden={hidden}
        showAll={history.showAll}
        onClear={() => history.clear(clearable)}
        onToggleShowAll={history.toggleShowAll}
        note="Clears rejected and cancelled requests. Pending and approved bookings stay."
      />

      {bookings.length === 0 ? (
        <div className="glass-panel placeholder-panel">
          <p>You haven't requested a room yet. Head to Rooms to submit a booking.</p>
        </div>
      ) : (
        <div className="list">
          {shown.map((b) => (
            <div key={b.id} className="list-row">
              <div>
                <p className="list-row__title">
                  Room <mark className="hl">{b.room_number ?? b.room_id}</mark>
                  {b.hostel ? ` · ${b.hostel}` : ""}
                </p>
                <p className="list-row__meta">
                  {b.semester} &middot; requested {formatDateTime(b.created_at)}
                </p>
              </div>
              <span className={"badge badge--" + statusTone(b.status)}>
                {STATUS_LABELS[b.status] ?? b.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BookingsTab;
