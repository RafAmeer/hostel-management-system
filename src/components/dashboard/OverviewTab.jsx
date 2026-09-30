import Avatar from "./Avatar";
import AnnouncementsPanel from "./AnnouncementsPanel";
import { NAV_ICONS } from "./icons";
import { formatDateTime, ELIGIBILITY_LABELS, eligibilityTone } from "../../lib/formatters";

function getGreetingTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

// Matches the "Home" wireframe: a combined greeting + profile card and news
// & announcements on the left, Quick Access + Notifications on the right.
function OverviewTab({ profile, bookings, complaints, curfewLogs, announcements = [], onNavigate }) {
  // "Your room" only counts once the warden has approved it. A pending
  // request is shown as a request, not as the student's room.
  const approvedBooking = bookings.find((b) => b.status === "approved");
  const pendingBooking = bookings.find((b) => b.status === "pending");
  const notInHostel = profile?.in_hostel === false;
  const roomLabel = approvedBooking?.room_number ?? profile?.room_number ?? "Not assigned";
  const openComplaints = complaints.filter(
    (c) => c.status !== "completed"
  ).length;
  const lastScan = curfewLogs[0];
  const firstName = (profile?.full_name ?? "Student").split(" ")[0];

  const quickAccessItems = [
    { key: "rooms", label: "Room Registration", icon: "rooms" },
    { key: "bookings", label: "Status Tracking", icon: "status" },
    { key: "complaints", label: "Complaint", icon: "complaint" },
    { key: "curfew", label: "Curfew", icon: "curfew" },
  ];

  // Important words are wrapped in <mark className="hl"> so they stand out.
  const notifications = [];
  if (approvedBooking) {
    notifications.push(
      <>
        Booking for Room {approvedBooking.room_number} was <mark className="hl hl--ok">approved</mark>
      </>
    );
  }
  if (pendingBooking) {
    notifications.push(
      <>
        Room {pendingBooking.room_number ?? ""} request is <mark className="hl">pending</mark> warden approval
      </>
    );
  }
  if (openComplaints > 0) {
    notifications.push(
      <>
        <mark className="hl">
          {openComplaints} complaint{openComplaints > 1 ? "s" : ""}
        </mark>{" "}
        still open
      </>
    );
  }
  if (lastScan) {
    notifications.push(
      <>
        Last curfew scan: <mark className="hl">{lastScan.scan_type.replace("_", " ")}</mark> ·{" "}
        {formatDateTime(lastScan.timestamp)}
      </>
    );
  }

  return (
    <div className="tab home-grid">
      <div className="home-grid__main">
        <section className="glass-panel profile-panel">
          <div className="profile-panel__head">
            <div>
              <h2 className="greeting-card__title">
                Good {getGreetingTime()}, {firstName}.
              </h2>
              <p className="greeting-card__subtitle">
                Here's a quick look at your hostel status.
              </p>
            </div>
            <button type="button" className="link-btn" onClick={() => onNavigate?.("profile")}>
              Edit profile
            </button>
          </div>
          <div className="profile-panel__row">
            <Avatar url={profile?.avatar_url} name={profile?.full_name} size={76} />
            <dl className="profile-panel__details">
              <div>
                <dt>Name</dt>
                <dd>{profile?.full_name ?? "—"}</dd>
              </div>
              <div>
                <dt>ID</dt>
                <dd>{profile?.student_id ?? "—"}</dd>
              </div>
              <div>
                <dt>Semester</dt>
                <dd>{approvedBooking?.semester ?? profile?.semester ?? "—"}</dd>
              </div>
              <div>
                <dt>Eligibility</dt>
                <dd>
                  <span className={"badge badge--" + eligibilityTone(profile?.eligibility_status)}>
                    {ELIGIBILITY_LABELS[profile?.eligibility_status] ?? "Pending"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className={"room-tag" + (notInHostel ? " room-tag--away" : "")}>
            <span className="room-tag__ring" aria-hidden="true" />
            <span className="room-tag__eyebrow">{notInHostel ? "Hostel status" : "Your room"}</span>
            <span className="room-tag__number">
              {notInHostel ? "Not staying in hostel" : roomLabel}
            </span>
            <span className="room-tag__hostel">
              {pendingBooking
                ? `Request for Room ${pendingBooking.room_number ?? ""} is pending`
                : notInHostel
                ? "Book a room under Rooms to move in"
                : approvedBooking || profile?.room_number
                ? "Current resident"
                : "No room booked yet"}
            </span>
          </div>
        </section>

        <AnnouncementsPanel announcements={announcements} />
      </div>

      <div className="home-grid__side">
        <section className="glass-panel side-panel">
          <h3 className="panel-heading">Quick Access</h3>
          <div className="quick-access">
            {quickAccessItems.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              return (
                <button
                  key={item.key}
                  type="button"
                  className="quick-access__btn"
                  onClick={() => onNavigate?.(item.key)}
                >
                  {Icon && (
                    <span className="quick-access__icon" aria-hidden="true">
                      <Icon />
                    </span>
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-panel side-panel">
          <h3 className="panel-heading">Notification / Reminders</h3>
          {notifications.length === 0 ? (
            <p className="notification-item notification-item--empty">
              No new notification
            </p>
          ) : (
            <ul className="notification-list">
              {notifications.map((note, i) => (
                <li key={i} className="notification-item">
                  {note}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default OverviewTab;
