import { DIRECTIONS, formatTime, nextTrip, tripsForDay } from "../../lib/transport";

// Small "Shuttle today" table for the student Home screen. Full details live
// on the Transport tab.
function TransportToday({ schedule, scope, residences, onOpen }) {
  if (scope.mode === "none") return null;

  const today = new Date().getDay();
  const trips = tripsForDay(schedule, today);
  const upcoming = nextTrip(trips);
  const hostelName = (id) => residences.find((r) => r.id === id)?.name ?? id;
  const showHostel = scope.mode === "all";

  return (
    <section className="glass-panel side-panel" aria-labelledby="transport-today-title">
      <div className="side-panel__head">
        <h3 className="panel-heading" id="transport-today-title">
          🚌 Shuttle today
        </h3>
        <button type="button" className="link-btn" onClick={onOpen}>
          Full timetable
        </button>
      </div>

      {trips.length === 0 ? (
        <p className="notification-item notification-item--empty">No shuttle trips today.</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Trip</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className={upcoming?.id === t.id ? "mini-table__next" : undefined}>
                <td className="mini-table__time">{formatTime(t.departure_time)}</td>
                <td>
                  <span className="mini-table__route">{t.route_name}</span>
                  <span className="mini-table__meta">
                    {showHostel ? `${hostelName(t.hostel_id)} · ` : ""}
                    {DIRECTIONS[t.direction] ?? ""}
                    {upcoming?.id === t.id ? " · next" : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default TransportToday;
