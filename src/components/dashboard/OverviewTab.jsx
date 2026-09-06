function OverviewTab({ profile, bookings, complaints, curfewLogs }) {
  const activeBooking = bookings.find((b) => b.status !== "cancelled");
  const openComplaints = complaints.filter(
    (c) => c.status !== "completed"
  ).length;
  const lastScan = curfewLogs[0];

  return (
    <div className="tab">
      <h2 className="tab__title">Overview</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Eligibility</span>
          <span
            className={
              "stat-card__value badge badge--" +
              (profile.eligibility_status === "eligible" ? "ok" : "warn")
            }
          >
            {profile.eligibility_status ?? "unknown"}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Current Booking</span>
          <span className="stat-card__value">
            {activeBooking ? activeBooking.room_number : "No active booking"}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Open Complaints</span>
          <span className="stat-card__value">{openComplaints}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Last Curfew Scan</span>
          <span className="stat-card__value">
            {lastScan
              ? `${lastScan.scan_type.replace("_", " ")} · ${lastScan.timestamp}`
              : "No scans yet"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default OverviewTab;