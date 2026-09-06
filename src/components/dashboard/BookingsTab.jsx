const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function BookingsTab({ bookings }) {
  return (
    <div className="tab">
      <h2 className="tab__title">My Bookings</h2>

      {bookings.length === 0 ? (
        <p className="tab__empty">You haven't requested a room yet.</p>
      ) : (
        <div className="list">
          {bookings.map((b) => (
            <div key={b.id} className="list-row">
              <div>
                <p className="list-row__title">{b.room_number}</p>
                <p className="list-row__meta">
                  {b.semester} · requested {b.created_at}
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

function statusTone(status) {
  if (status === "approved") return "ok";
  if (status === "rejected" || status === "cancelled") return "danger";
  return "warn";
}

export default BookingsTab;