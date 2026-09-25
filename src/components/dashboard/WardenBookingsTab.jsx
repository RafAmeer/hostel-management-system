const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function statusTone(status) {
  if (status === "approved") return "ok";
  if (status === "rejected" || status === "cancelled") return "danger";
  return "warn";
}

// Bookings still awaiting a decision are what the warden actually needs to
// act on, so they're grouped and shown first — newest request first within
// each group — instead of one flat list ordered only by request date.
const STATUS_PRIORITY = { pending: 0, approved: 1, cancelled: 2, rejected: 3 };

function sortByPriority(bookings) {
  return [...bookings].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? 99;
    const pb = STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function BookingRow({ b, onApprove, onReject }) {
  // A booking with no room_id came from a placeholder/preview room that
  // isn't a real `rooms` row yet (see RoomsTab.jsx handleBook) — flag it so
  // the warden knows to add that room before approving.
  const isPlaceholderRoom = !b.room_id;
  return (
    <div className="list-row">
      <div>
        <p className="list-row__title">
          {b.student_name} &middot; {b.room_number}
          {b.hostel ? ` (${b.hostel}${b.floor ? `, ${b.floor}` : ""})` : ""}
        </p>
        <p className="list-row__meta">
          {b.semester} &middot; requested {b.created_at}
          {isPlaceholderRoom && " · room not yet added to the system"}
        </p>
      </div>

      <div className="list-row__actions">
        <span className={"badge badge--" + statusTone(b.status)}>
          {STATUS_LABELS[b.status] ?? b.status}
        </span>
        {b.status === "pending" && (
          <>
            <button className="primary-btn btn-sm" onClick={() => onApprove(b.id)}>
              Approve
            </button>
            <button className="btn-outline" onClick={() => onReject(b.id)}>
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function WardenBookingsTab({ bookings, onApprove, onReject }) {
  const sorted = sortByPriority(bookings);
  const pending = sorted.filter((b) => b.status === "pending");
  const decided = sorted.filter((b) => b.status !== "pending");

  return (
    <div className="tab">
      <h2 className="tab__title">Room Bookings</h2>

      {bookings.length === 0 ? (
        <p className="tab__empty">No booking requests yet.</p>
      ) : (
        <>
          <h3 className="panel-heading panel-heading--sub">
            Needs action{pending.length > 0 ? ` (${pending.length})` : ""}
          </h3>
          {pending.length === 0 ? (
            <p className="tab__empty">Nothing pending right now.</p>
          ) : (
            <div className="list">
              {pending.map((b) => (
                <BookingRow key={b.id} b={b} onApprove={onApprove} onReject={onReject} />
              ))}
            </div>
          )}

          {decided.length > 0 && (
            <>
              <h3 className="panel-heading panel-heading--sub">Already decided</h3>
              <div className="list">
                {decided.map((b) => (
                  <BookingRow key={b.id} b={b} onApprove={onApprove} onReject={onReject} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default WardenBookingsTab;
