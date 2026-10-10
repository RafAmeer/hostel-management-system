import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { ACTIVE_BOOKING_STATUSES } from "../../lib/semesters";
import { isOffCampus, residenceForBooking } from "../../lib/hostelOf";
import { formatDateTime } from "../../lib/formatters";

const REQUEST_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function requestTone(status) {
  if (status === "approved") return "ok";
  if (status === "rejected" || status === "cancelled") return "danger";
  return "warn";
}

function loadFor(loads, routeId, semester) {
  return loads.find((l) => l.route_id === routeId && l.semester === semester) ?? { approved: 0, pending: 0 };
}

function RouteCard({ route, semester, loads, children }) {
  const load = loadFor(loads, route.id, semester);
  const seatsLeft = Math.max(0, (route.seats ?? 0) - (load.approved ?? 0));
  return (
    <div className="glass-panel route-card">
      <div className="route-card__head">
        <h4 className="route-card__name">{route.name}</h4>
        <span className={"badge badge--" + (seatsLeft === 0 ? "danger" : "ok")}>
          {seatsLeft === 0 ? "Full" : `${seatsLeft} seats left`}
        </span>
      </div>
      <p className="list-row__meta">
        {route.pickup_point || "Pick-up at the hostel"} → {route.destination}
      </p>
      <p className="list-row__meta">
        {route.days}
        {Number(route.fee) > 0 ? ` · RM ${route.fee}/semester` : " · Free for hostel students"}
      </p>
      {route.departure_times?.length > 0 && (
        <ul className="chip-list" aria-label="Departure times">
          {route.departure_times.map((t) => (
            <li key={t} className="chip">
              {t}
            </li>
          ))}
        </ul>
      )}
      {route.notes && <p className="list-row__meta">{route.notes}</p>}
      {children}
    </div>
  );
}

// Student view of the campus shuttle. The campus provides transport for
// students whose hostel is outside the main campus, so seat requests are
// tied to a live (pending/approved) booking at an off-campus hostel — one
// request per semester, the same way a student books one hostel per
// semester.
function TransportTab({
  routes,
  requests,
  loads,
  bookings,
  rooms,
  residences,
  studentId,
  loadError,
  onChanged,
}) {
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState("");

  const activeRoutes = routes.filter((r) => r.active !== false);
  const liveBookings = bookings.filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status));
  const offCampusBookings = liveBookings
    .map((b) => ({ booking: b, residence: residenceForBooking(b, rooms, residences) }))
    .filter((x) => isOffCampus(x.residence));
  const onCampusOnly = liveBookings.length > 0 && offCampusBookings.length === 0;

  const liveRequestFor = (semester) =>
    requests.find((r) => r.semester === semester && ACTIVE_BOOKING_STATUSES.includes(r.status)) ?? null;

  const requestSeat = async (route, semester) => {
    setMessage("");
    setBusyKey(route.id + semester);
    const { error } = await supabase
      .from("transport_requests")
      .insert({ student_id: studentId, route_id: route.id, semester, status: "pending" });
    setBusyKey(null);
    if (error) {
      setMessage(
        error.code === "23505"
          ? `You already have a transport request for ${semester}. Cancel it first to pick another route.`
          : `Couldn't send the request: ${error.message}`
      );
      return;
    }
    setMessage(`Seat requested on ${route.name} for ${semester}. The warden will confirm it.`);
    onChanged?.();
  };

  const cancelRequest = async (req) => {
    setMessage("");
    setBusyKey(req.id);
    const { error } = await supabase
      .from("transport_requests")
      .update({ status: "cancelled" })
      .eq("id", req.id)
      .eq("student_id", studentId);
    setBusyKey(null);
    if (error) {
      setMessage(`Couldn't cancel: ${error.message}`);
      return;
    }
    onChanged?.();
  };

  if (loadError) {
    return (
      <div className="tab">
        <h2 className="tab__title">Transport</h2>
        <p className="message message--info" role="status">
          Transport isn't set up yet. Ask the warden to run
          supabase/migrations/2026-10-08_transport_booking_rules_device.sql. ({loadError})
        </p>
      </div>
    );
  }

  const routeById = new Map(routes.map((r) => [r.id, r]));

  return (
    <div className="tab">
      <h2 className="tab__title">Transport</h2>
      <p className="tab__subtitle-text">
        The campus runs a shuttle for students who live in hostels outside the main campus. Request one
        seat per semester for the hostel you booked.
      </p>

      {message && (
        <p className="tab__message" role="status">
          {message}
        </p>
      )}

      {offCampusBookings.length === 0 ? (
        <div className="glass-panel placeholder-panel">
          <p>
            {onCampusOnly
              ? "Your hostel is on the main campus, so you can walk to class — no shuttle needed."
              : "Book an off-campus hostel under Rooms first. Shuttle seats open up once you have a booking."}
          </p>
        </div>
      ) : (
        offCampusBookings.map(({ booking, residence }) => {
          const semester = booking.semester;
          const live = liveRequestFor(semester);
          const hostelRoutes = activeRoutes.filter((r) => r.hostel_id === residence.id);
          return (
            <section key={booking.id} className="transport-section">
              <h3 className="panel-heading panel-heading--sub">
                {residence.name} · {semester}
              </h3>
              <p className="list-row__meta">
                Your hostel booking is {booking.status}.
                {live ? " You already have a seat request for this semester." : ""}
              </p>

              {hostelRoutes.length === 0 ? (
                <p className="tab__empty">No shuttle route is listed for this hostel yet. Ask the warden.</p>
              ) : (
                <div className="route-grid">
                  {hostelRoutes.map((route) => {
                    const load = loadFor(loads, route.id, semester);
                    const full = (load.approved ?? 0) >= (route.seats ?? 0);
                    const mine = live?.route_id === route.id;
                    return (
                      <RouteCard key={route.id} route={route} semester={semester} loads={loads}>
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={Boolean(live) || full || busyKey === route.id + semester}
                          onClick={() => requestSeat(route, semester)}
                        >
                          {mine
                            ? `Requested (${REQUEST_LABELS[live.status]})`
                            : live
                              ? "Already requested"
                              : full
                                ? "Full"
                                : busyKey === route.id + semester
                                  ? "Sending…"
                                  : "Request a seat"}
                        </button>
                      </RouteCard>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}

      <h3 className="panel-heading panel-heading--sub">My Requests</h3>
      {requests.length === 0 ? (
        <p className="tab__empty">No transport requests yet.</p>
      ) : (
        <div className="list">
          {requests.map((r) => (
            <div key={r.id} className="list-row">
              <div>
                <p className="list-row__title">{routeById.get(r.route_id)?.name ?? "Shuttle route"}</p>
                <p className="list-row__meta">
                  {r.semester} · requested {formatDateTime(r.created_at)}
                </p>
              </div>
              <div className="list-row__actions">
                <span className={"badge badge--" + requestTone(r.status)}>
                  {REQUEST_LABELS[r.status] ?? r.status}
                </span>
                {r.status === "pending" && (
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={busyKey === r.id}
                    onClick={() => cancelRequest(r)}
                  >
                    Cancel
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

export default TransportTab;
