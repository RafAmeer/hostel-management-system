import { useState } from "react";
import {
  DAY_LONG,
  DAY_SHORT,
  DIRECTIONS,
  describeDays,
  formatTime,
  nextTrip,
  scopeSchedule,
  studentTransportScope,
  tripsForDay,
} from "../../lib/transport";

// Student view of the campus shuttle: a fixed timetable the warden maintains.
// Nothing to book or request — pick a day to see every trip, with pick-up
// point, destination and notes.
function TransportTab({ schedule, bookings, rooms, residences, loadError }) {
  const [day, setDay] = useState(() => new Date().getDay());

  if (loadError) {
    return (
      <div className="tab">
        <h2 className="tab__title">Transport</h2>
        <p className="message message--info" role="status">
          The shuttle timetable isn't set up yet. Ask the warden to run
          supabase/migrations/2026-10-10_remarks_help_transport_passkeys.sql. ({loadError})
        </p>
      </div>
    );
  }

  const today = new Date().getDay();
  const scope = studentTransportScope(bookings, rooms, residences);
  const mine = scopeSchedule(schedule.filter((t) => t.active !== false), scope);
  const hostelName = (id) => residences.find((r) => r.id === id)?.name ?? id;
  const trips = tripsForDay(mine, day);
  const upcoming = day === today ? nextTrip(trips) : null;

  // Group the chosen day's trips by hostel + route so each route reads as
  // one card with its departure times.
  const groups = new Map();
  for (const t of trips) {
    const key = `${t.hostel_id}|${t.route_name}|${t.direction}`;
    if (!groups.has(key)) groups.set(key, { ...t, times: [] });
    groups.get(key).times.push(t);
  }

  return (
    <div className="tab">
      <h2 className="tab__title">Transport</h2>
      <p className="tab__subtitle-text">
        The campus shuttle runs on a fixed timetable for hostels outside the main campus. No booking
        needed — just be at the pick-up point.
      </p>

      {scope.mode === "none" ? (
        <div className="glass-panel placeholder-panel">
          <p>Your hostel is on the main campus, so you can walk to class — no shuttle needed.</p>
        </div>
      ) : (
        <>
          <p className="list-row__meta">
            {scope.mode === "hostels"
              ? `Showing trips for ${scope.hostelIds.map(hostelName).join(", ")}.`
              : "Showing every hostel's trips. Book a hostel under Rooms to see just yours."}
          </p>

          <div className="day-tabs" role="tablist" aria-label="Day of the week">
            {DAY_SHORT.map((label, i) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={day === i}
                className={"day-tabs__btn" + (day === i ? " day-tabs__btn--active" : "")}
                onClick={() => setDay(i)}
              >
                {label}
                {i === today && <span className="day-tabs__today">Today</span>}
              </button>
            ))}
          </div>

          <h3 className="panel-heading panel-heading--sub">
            {DAY_LONG[day]}
            {day === today ? " (today)" : ""}
          </h3>

          {groups.size === 0 ? (
            <p className="tab__empty">No shuttle trips on {DAY_LONG[day]}.</p>
          ) : (
            <div className="route-grid">
              {[...groups.values()].map((g) => (
                <div key={`${g.hostel_id}|${g.route_name}|${g.direction}`} className="glass-panel route-card">
                  <div className="route-card__head">
                    <h4 className="route-card__name">{g.route_name}</h4>
                    <span className="badge badge--neutral">{DIRECTIONS[g.direction] ?? "Shuttle"}</span>
                  </div>
                  <p className="list-row__meta">{hostelName(g.hostel_id)}</p>
                  <p className="list-row__meta">
                    {g.pickup_point || "Pick-up at the hostel"} → {g.destination || "Main Campus"}
                  </p>
                  <ul className="chip-list" aria-label="Departure times">
                    {g.times.map((t) => (
                      <li
                        key={t.id}
                        className={"chip" + (upcoming?.id === t.id ? " chip--next" : "")}
                      >
                        {formatTime(t.departure_time)}
                        {upcoming?.id === t.id ? " · next" : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="list-row__meta">Runs {describeDays(g.days)}</p>
                  {[...new Set(g.times.map((t) => t.notes).filter(Boolean))].map((n) => (
                    <p key={n} className="list-row__meta">
                      {n}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default TransportTab;
