const STATUS_LABELS = {
  checked_in: "Checked in",
  out: "Out",
  overdue: "Overdue",
};

function statusTone(status) {
  if (status === "checked_in") return "ok";
  if (status === "overdue") return "danger";
  return "warn";
}

function WardenCurfewTab({ curfewStatuses, onCheckIn }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Curfew</h2>
      <p className="tab__subtitle-text">
        Live check-out/check-in status per student. "Log Check-In" stands in
        for the entrance QR scanner until the kiosk hardware is set up.
      </p>

      <div className="list">
        {curfewStatuses.map((s) => (
          <div key={s.id} className="list-row">
            <div>
              <p className="list-row__title">
                {s.student_name} &middot; {s.room_number}
              </p>
              <p className="list-row__meta">
                Out since {s.check_out_time}
                {s.check_in_time ? ` \u00b7 checked in ${s.check_in_time}` : ""}
              </p>
            </div>

            <div className="list-row__actions">
              <span className={"badge badge--" + statusTone(s.status)}>
                {STATUS_LABELS[s.status] ?? s.status}
              </span>
              {s.status !== "checked_in" && (
                <button className="primary-btn btn-sm" onClick={() => onCheckIn(s.id)}>
                  Log Check-In
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WardenCurfewTab;
