import Avatar from "./Avatar";
import AnnouncementsPanel from "./AnnouncementsPanel";
import CurfewScanCard from "./CurfewScanCard";
import TransportToday from "./TransportToday";
import { scopeSchedule, studentTransportScope } from "../../lib/transport";
import { formatDateTime, ELIGIBILITY_LABELS, eligibilityTone } from "../../lib/formatters";

function getGreetingTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

const GREETING_LINES = {
  morning: "Rise and shine! Here's what's happening at your hostel.",
  afternoon: "Hope your day's going great. Here's your hostel at a glance.",
  evening: "Winding down? Here's a quick look before curfew.",
};

// Matches the "Home" wireframe: a combined greeting + profile card and news
// & announcements on the left, Quick Access + Notifications on the right.
function OverviewTab({
  profile,
  bookings,
  complaints,
  curfewLogs,
  announcements = [],
  helpTickets = [],
  rooms = [],
  residences = [],
  schedule = [],
  transportError = "",
  onNavigate,
}) {
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
  const transportScope = studentTransportScope(bookings, rooms, residences);
  const myTrips = scopeSchedule(schedule, transportScope);
  const answeredHelp = helpTickets.filter((t) => t.status === "answered").length;
  const firstName = (profile?.full_name ?? "Student").split(" ")[0];
  const openHelp = helpTickets.filter((t) => t.status === "open").length;
  const latestBooking = approvedBooking ?? pendingBooking ?? bookings[0];

  // At-a-glance status cards. On phones these replace the Status and Help
  // tabs that were dropped from the bottom bar, so each card opens its page.
  // Short time for the small cards: "9:41 PM" today, otherwise "24 Oct".
  const shortWhen = (iso) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  };

  const curfewTile = !lastScan
    ? { value: "No scans yet", hint: "Scan at the entrance", tone: "neutral" }
    : lastScan.scan_type === "check_out"
    ? { value: "Checked out", hint: `Since ${shortWhen(lastScan.timestamp)}`, tone: "warn" }
    : { value: "In hostel", hint: `Since ${shortWhen(lastScan.timestamp)}`, tone: "ok" };

  const BOOKING_TEXT = { approved: "Approved", pending: "Pending", rejected: "Rejected", cancelled: "Cancelled" };
  const BOOKING_TONE = { approved: "ok", pending: "warn", rejected: "danger", cancelled: "neutral" };
  const bookingTile = latestBooking
    ? {
        value: BOOKING_TEXT[latestBooking.status] ?? latestBooking.status,
        hint: latestBooking.room_number ? `Room ${latestBooking.room_number}` : "Room request",
        tone: BOOKING_TONE[latestBooking.status] ?? "neutral",
      }
    : { value: "No booking", hint: "Find a room", tone: "neutral" };

  const helpTile =
    answeredHelp > 0
      ? { value: `${answeredHelp} repl${answeredHelp > 1 ? "ies" : "y"}`, hint: "From the warden", tone: "ok" }
      : openHelp > 0
      ? { value: `${openHelp} open`, hint: "Waiting for warden", tone: "warn" }
      : { value: "Ask us", hint: "Questions & support", tone: "neutral" };

  const statusTiles = [
    { key: "curfew", label: "Curfew", emoji: "🌙", ...curfewTile },
    { key: "bookings", label: "Booking status", emoji: "📋", ...bookingTile },
    { key: "help", label: "Help Center", emoji: "💬", ...helpTile },
  ];

  const quickAccessItems = [
    { key: "rooms", label: "Find a room", emoji: "🛏️" },
    { key: "bookings", label: "My booking status", emoji: "📋" },
    { key: "complaints", label: "Report a problem", emoji: "🛠️" },
    { key: "curfew", label: "Curfew check-in", emoji: "🌙" },
    { key: "help", label: "Ask the warden", emoji: "💬" },
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
  if (answeredHelp > 0) {
    notifications.push(
      <>
        The warden <mark className="hl hl--ok">replied</mark> to {answeredHelp} help request{answeredHelp > 1 ? "s" : ""}
      </>
    );
  }
  if (lastScan) {
    notifications.push(
      <>
        Last curfew scan: <mark className="hl">{lastScan.scan_type === "check_out" ? "check out" : "check in"}</mark> ·{" "}
        {formatDateTime(lastScan.timestamp)}
      </>
    );
  }

  return (
    <div className="tab home-grid">
      <div className="home-grid__main">
        <section className="glass-panel profile-panel home-greeting">
          <div className="profile-panel__head">
            <div>
              <h2 className="greeting-card__title">
                Good {getGreetingTime()}, {firstName}!{" "}
                <span className="home-greeting__wave" aria-hidden="true">
                  👋
                </span>
              </h2>
              <p className="greeting-card__subtitle">{GREETING_LINES[getGreetingTime()]}</p>
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
                : "No room yet. Let's find you one!"}
            </span>
          </div>
        </section>

        <section className="home-status" aria-label="Your status">
          {statusTiles.map((t) => (
            <button
              key={t.key}
              type="button"
              className={"home-status__tile home-status__tile--" + t.key}
              onClick={() => onNavigate?.(t.key)}
            >
              <span className="home-status__label">
                <span aria-hidden="true">{t.emoji}</span> {t.label}
              </span>
              <span className={"badge badge--" + t.tone + " home-status__value"}>{t.value}</span>
              <span className="home-status__hint">{t.hint}</span>
            </button>
          ))}
        </section>

        <AnnouncementsPanel announcements={announcements} />

        <CurfewScanCard compact />

      </div>

      <div className="home-grid__side">
        <section className="glass-panel side-panel">
          <h3 className="panel-heading">⚡ Quick Access</h3>
          <div className="quick-access">
            {quickAccessItems.map((item) => {
              return (
                <button
                  key={item.key}
                  type="button"
                  className="quick-access__btn"
                  onClick={() => onNavigate?.(item.key)}
                >
                  <span className="quick-access__icon" aria-hidden="true">
                    {item.emoji}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </div>
        </section>

        {!transportError && (
          <TransportToday
            schedule={myTrips}
            scope={transportScope}
            residences={residences}
            onOpen={() => onNavigate?.("transport")}
          />
        )}

        <section className="glass-panel side-panel">
          <h3 className="panel-heading">🔔 Reminders</h3>
          {notifications.length === 0 ? (
            <p className="notification-item notification-item--empty">
              All caught up! Nothing new right now.
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
