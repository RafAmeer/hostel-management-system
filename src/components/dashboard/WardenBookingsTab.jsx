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

function WardenBookingsTab({ bookings, onApprove, onReject }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Room Bookings</h2>

      {bookings.length === 0 ? (
        <p className="tab__empty">No booking requests yet.</p>
      ) : (
        <div className="list">
          {bookings.map((b) => (
            <div key={b.id} className="list-row">
              <div>
                <p className="list-row__title">
                  {b.student_name} &middot; {b.room_number}
                </p>
                <p className="list-row__meta">
                  {b.semester} &middot; requested {b.created_at}
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
          ))}
        </div>
      )}
    </div>
  );
}

export default WardenBookingsTab;
