import { useMemo, useState } from "react";
import ReportExportButton from "./ReportExportButton";
import { buildOccupancy } from "../../lib/occupancy";
import { buildOccupancyReport } from "../../lib/buildReports";

// Hostel & room occupancy (warden feedback): occupied vs vacant beds per
// hostel, every room with who lives in it, and a room transfer action.
function WardenOccupancyTab({ residences, rooms, students, bookings, onTransfer }) {
  const occ = useMemo(() => buildOccupancy(residences, rooms, students, bookings), [residences, rooms, students, bookings]);
  const [hostelId, setHostelId] = useState("all");
  const [show, setShow] = useState("all");
  const [transfer, setTransfer] = useState(null); // { student, fromRoom }

  const hostels = hostelId === "all" ? occ.hostels : occ.hostels.filter((h) => h.id === hostelId);

  const roomFilter = (r) =>
    show === "all" || (show === "vacant" && r.vacant > 0) || (show === "full" && r.capacity > 0 && r.vacant === 0) || (show === "empty" && r.occupied === 0);

  return (
    <div className="tab">
      <div className="tab__title-row">
        <h2 className="tab__title">Occupancy</h2>
        <ReportExportButton buildReport={() => buildOccupancyReport(residences, rooms, students, bookings)} />
      </div>
      <p className="tab__subtitle-text">
        Beds and residents for every room added under Hostels &amp; Rooms. A student counts as a resident once their
        booking is approved (or the warden moves them here).
      </p>

      <div className="stat-mini-row">
        <div className="stat-mini">
          <strong>{occ.totals.rate}%</strong>
          <span>Occupied</span>
        </div>
        <div className="stat-mini">
          <strong>
            {occ.totals.occupied}/{occ.totals.beds}
          </strong>
          <span>Beds used</span>
        </div>
        <div className="stat-mini stat-mini--ok">
          <strong>{occ.totals.vacant}</strong>
          <span>Vacant beds</span>
        </div>
        <div className="stat-mini">
          <strong>{occ.totals.emptyRooms}</strong>
          <span>Empty rooms</span>
        </div>
      </div>

      {occ.hostels.length === 0 ? (
        <p className="tab__empty">No rooms have been added yet. Add rooms under Hostels &amp; Rooms to track occupancy.</p>
      ) : (
        <>
          <div className="occupancy-bars">
            {occ.hostels.map((h) => (
              <button
                key={h.id}
                type="button"
                className={"occupancy-bar" + (hostelId === h.id ? " occupancy-bar--active" : "")}
                onClick={() => setHostelId(hostelId === h.id ? "all" : h.id)}
              >
                <span className="occupancy-bar__name">{h.name}</span>
                <span className="occupancy-bar__track" aria-hidden="true">
                  <span className="occupancy-bar__fill" style={{ width: `${h.rate}%` }} />
                </span>
                <span className="occupancy-bar__nums">
                  {h.occupied}/{h.beds} beds · {h.vacant} vacant
                </span>
              </button>
            ))}
          </div>

          <div className="filter-chips" role="tablist" aria-label="Room filter">
            {[
              { key: "all", label: "All rooms" },
              { key: "vacant", label: "Has a vacant bed" },
              { key: "full", label: "Full" },
              { key: "empty", label: "Empty" },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={show === f.key}
                className={"filter-chip" + (show === f.key ? " filter-chip--active" : "")}
                onClick={() => setShow(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {hostels.map((h) => {
            const list = h.rooms.filter(roomFilter);
            if (list.length === 0) return null;
            return (
              <section key={h.id} className="occupancy-hostel">
                <h3 className="panel-heading panel-heading--sub">
                  {h.name} <span className="list-row__meta">· {h.rate}% occupied</span>
                </h3>
                <div className="room-grid">
                  {list.map((r) => (
                    <div
                      key={r.id}
                      className={
                        "room-cell" +
                        (r.vacant === 0 && r.capacity > 0 ? " room-cell--full" : r.occupied === 0 ? " room-cell--empty" : "")
                      }
                    >
                      <div className="room-cell__head">
                        <strong>{r.room_number}</strong>
                        <span className="list-row__meta">
                          {r.floor ?? ""}
                          {r.gender ? ` · ${r.gender}` : ""}
                        </span>
                      </div>
                      <p className="room-cell__beds">
                        {r.occupied}/{r.capacity} beds
                        {r.pending ? <span className="badge badge--warn">{r.pending} pending</span> : null}
                      </p>
                      {r.residents.length > 0 ? (
                        <ul className="room-cell__people">
                          {r.residents.map((s) => (
                            <li key={s.id}>
                              <span>{s.full_name ?? "Unnamed"}</span>
                              <button type="button" className="link-btn" onClick={() => setTransfer({ student: s, fromRoom: r.room_number })}>
                                Move
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="list-row__meta">{r.occupied > 0 ? "Occupied (not linked to a student account)" : "Vacant"}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}

      {occ.unplaced.length > 0 && (
        <>
          <h3 className="panel-heading panel-heading--sub">In hostel, but room not found</h3>
          <p className="tab__subtitle-text">
            These students say they live in a hostel, but their room number doesn't match a room in the system.
          </p>
          <div className="list">
            {occ.unplaced.map((s) => (
              <div key={s.id} className="list-row">
                <div>
                  <p className="list-row__title">{s.full_name ?? "Unnamed"}</p>
                  <p className="list-row__meta">
                    {s.student_id ?? "No ID"} · Room on profile: {s.room_number}
                  </p>
                </div>
                <div className="list-row__actions">
                  <button type="button" className="primary-btn btn-sm" onClick={() => setTransfer({ student: s, fromRoom: s.room_number })}>
                    Assign room
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {transfer && (
        <TransferDialog
          transfer={transfer}
          hostels={occ.hostels}
          onCancel={() => setTransfer(null)}
          onConfirm={async (room) => {
            const ok = await onTransfer?.(transfer.student, room);
            if (ok) setTransfer(null);
          }}
        />
      )}
    </div>
  );
}

function TransferDialog({ transfer, hostels, onCancel, onConfirm }) {
  const { student, fromRoom } = transfer;
  const options = hostels.flatMap((h) =>
    h.rooms
      .filter((r) => r.vacant > 0 && r.room_number !== fromRoom && (!r.gender || !student.gender || r.gender === student.gender || r.gender === "mixed"))
      .map((r) => ({ ...r, hostelName: h.name }))
  );
  const [target, setTarget] = useState(options[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const room = options.find((o) => String(o.id) === String(target));

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="transfer-title" onClick={onCancel}>
      <div className="glass-panel transfer-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 id="transfer-title" className="panel-heading">
          Move {student.full_name ?? "student"}
        </h3>
        <p className="list-row__meta">Current room: {fromRoom ?? "—"}</p>
        {options.length === 0 ? (
          <p className="tab__empty">No other room with a vacant bed{student.gender ? ` for ${student.gender} students` : ""}.</p>
        ) : (
          <label className="field">
            <span className="field__label">New room (vacant beds only)</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.hostelName} · {o.room_number} ({o.vacant} free{o.gender ? `, ${o.gender}` : ""})
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="transfer-dialog__actions">
          <button type="button" className="btn-outline btn-outline--neutral" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={!room || busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(room);
              setBusy(false);
            }}
          >
            {busy ? "Moving…" : "Move student"}
          </button>
        </div>
        <p className="list-row__meta">The move is recorded in the Activity Log.</p>
      </div>
    </div>
  );
}

export default WardenOccupancyTab;
