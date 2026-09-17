const STATUS_TONE = { paid: "ok", outstanding: "warn", overdue: "danger" };

// "Record and update student hostel payment status" + "monitor outstanding
// and completed payments" from the proposal's Finance Module. Marking a
// payment paid updates local state immediately and best-effort mirrors it
// to Supabase in the background — same optimistic-update pattern the
// Warden tabs already use for bookings/complaints.
function PaymentsTab({ payments, onMarkPaid }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Payments</h2>

      {payments.length === 0 ? (
        <p className="tab__empty">No payment records yet.</p>
      ) : (
        <div className="list">
          {payments.map((p) => (
            <div key={p.id} className="list-row">
              <div>
                <p className="list-row__title">
                  {p.student_name} &middot; RM {p.amount}
                </p>
                <p className="list-row__meta">
                  Room {p.room_number} &middot; {p.semester} &middot; Due {p.due_date}
                </p>
              </div>

              <div className="list-row__actions">
                <span className={"badge badge--" + (STATUS_TONE[p.status] ?? "neutral")}>{p.status}</span>
                {p.status !== "paid" && (
                  <button className="primary-btn btn-sm" onClick={() => onMarkPaid(p.id)}>
                    Mark Paid
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

export default PaymentsTab;
