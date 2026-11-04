import { useEffect, useMemo, useState } from "react";
import ReportExportButton from "./ReportExportButton";
import { buildCurfewReport } from "../../lib/buildReports";
import { buildMovementRecords, curfewLabel, formatDuration, formatStamp, MAX_OUT_HOURS } from "../../lib/curfew";
import { assetUrl } from "../../lib/assetUrl";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentPosition } from "../../lib/geo";
import { MapPinIcon, DownloadIcon } from "./icons";

function WardenCurfewTab({ curfewStatuses, curfewLogs = [], students = [], onCheckIn, residences = [] }) {
  const [view, setView] = useState("now");
  const overdue = curfewStatuses.filter((s) => s.status === "overdue");
  const out = curfewStatuses.filter((s) => s.status !== "overdue");

  return (
    <div className="tab">
      <div className="tab__title-row">
        <h2 className="tab__title">Curfew</h2>
        <ReportExportButton buildReport={() => buildCurfewReport(curfewLogs, students, curfewStatuses)} />
      </div>
      <p className="tab__subtitle-text">
        Curfew hours: <strong>{curfewLabel()}</strong>. A student is overdue if they are still out during curfew
        hours or have been out for more than {MAX_OUT_HOURS} hours. This page updates by itself.
      </p>

      <div className="stat-mini-row">
        <div className={"stat-mini" + (overdue.length ? " stat-mini--danger" : "")}>
          <strong>{overdue.length}</strong>
          <span>Overdue</span>
        </div>
        <div className="stat-mini">
          <strong>{out.length}</strong>
          <span>Out (on time)</span>
        </div>
        <div className="stat-mini">
          <strong>{curfewLogs.filter((l) => new Date(l.timestamp).toDateString() === new Date().toDateString()).length}</strong>
          <span>Scans today</span>
        </div>
      </div>

      <div className="filter-chips" role="tablist" aria-label="Curfew views">
        {[
          { key: "now", label: "Out right now" },
          { key: "history", label: "Movement records" },
          { key: "posters", label: "QR posters" },
        ].map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={"filter-chip" + (view === v.key ? " filter-chip--active" : "")}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "now" && (
        <>
          {overdue.length > 0 && (
            <>
              <h3 className="panel-heading panel-heading--sub text-danger">⚠️ Overdue — not back yet</h3>
              <div className="list">
                {overdue.map((s) => (
                  <OutRow key={s.id} s={s} onCheckIn={onCheckIn} />
                ))}
              </div>
            </>
          )}
          <h3 className="panel-heading panel-heading--sub">Out on time</h3>
          {out.length === 0 ? (
            <p className="tab__empty">{overdue.length ? "Everyone else is in." : "Everyone is checked in. 🌙"}</p>
          ) : (
            <div className="list">
              {out.map((s) => (
                <OutRow key={s.id} s={s} onCheckIn={onCheckIn} />
              ))}
            </div>
          )}
        </>
      )}

      {view === "history" && <MovementRecords curfewLogs={curfewLogs} students={students} />}

      {view === "posters" && <HostelQrSection residences={residences} />}
    </div>
  );
}

function OutRow({ s, onCheckIn }) {
  const overdue = s.status === "overdue";
  return (
    <div className={"list-row list-row--wrap" + (overdue ? " list-row--urgent" : "")}>
      <div>
        <p className="list-row__title">
          {s.student_name} &middot; Room {s.room_number}
        </p>
        <p className="list-row__meta">
          Checked out {s.check_out_time}
          {s.location ? ` at ${s.location}` : ""} &middot; out for {formatDuration(s.out_for_ms)}
          {s.overdue_reason ? ` · ${s.overdue_reason}` : ""}
        </p>
        {overdue && (s.phone || s.emergency_phone) && (
          <p className="list-row__meta">
            {s.phone && (
              <>
                Student: <a href={`tel:${s.phone.replace(/[\s-]/g, "")}`}>{s.phone}</a>
              </>
            )}
            {s.phone && s.emergency_phone ? " · " : ""}
            {s.emergency_phone && (
              <>
                Emergency ({s.emergency_name ?? "contact"}):{" "}
                <a href={`tel:${s.emergency_phone.replace(/[\s-]/g, "")}`}>{s.emergency_phone}</a>
              </>
            )}
          </p>
        )}
      </div>
      <div className="list-row__actions">
        <span className={"badge badge--" + (overdue ? "danger" : "warn")}>{overdue ? "Overdue" : "Out"}</span>
        <button className="primary-btn btn-sm" onClick={() => onCheckIn(s.id)}>
          Log Check-In
        </button>
      </div>
    </div>
  );
}

const RANGES = [
  { key: "1", label: "Today" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "all", label: "All" },
];

// Student movement records (warden feedback): every leave/return with
// timestamps, filterable by student and date range, late returns flagged.
// Only wardens can read curfew_logs for other students (RLS).
function MovementRecords({ curfewLogs, students }) {
  const [studentId, setStudentId] = useState("all");
  const [range, setRange] = useState("7");
  const [lateOnly, setLateOnly] = useState(false);
  const [openedAt] = useState(() => Date.now());

  const records = useMemo(() => buildMovementRecords(curfewLogs, students), [curfewLogs, students]);
  const knownStudents = useMemo(() => {
    const ids = new Set(records.map((r) => r.student_id));
    return students.filter((s) => ids.has(s.id)).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [records, students]);

  const shown = useMemo(() => {
    const since = range === "all" ? 0 : range === "1" ? new Date(openedAt).setHours(0, 0, 0, 0) : openedAt - Number(range) * 86400000;
    return records.filter(
      (r) =>
        (studentId === "all" || r.student_id === studentId) &&
        new Date(r.sortAt).getTime() >= since &&
        (!lateOnly || r.late)
    );
  }, [records, studentId, range, lateOnly, openedAt]);

  const lateCount = shown.filter((r) => r.late).length;

  return (
    <section>
      <div className="students-toolbar">
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label="Filter by student">
          <option value="all">All students</option>
          {knownStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? "Unnamed"} {s.student_id ? `(${s.student_id})` : ""}
            </option>
          ))}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <label className="remember">
          <input type="checkbox" checked={lateOnly} onChange={(e) => setLateOnly(e.target.checked)} />
          <span>Late returns only</span>
        </label>
      </div>

      <p className="list-row__meta">
        {shown.length} record{shown.length === 1 ? "" : "s"}
        {lateCount ? ` · ${lateCount} late` : ""}
      </p>

      {shown.length === 0 ? (
        <p className="tab__empty">No movement records for this filter.</p>
      ) : (
        <div className="glass-panel students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Left</th>
                <th>Returned</th>
                <th>Time out</th>
                <th>Hostel / scan point</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, 300).map((r) => (
                <tr key={r.key}>
                  <td>
                    <p className="students-table__name">{r.student_name}</p>
                    <p className="students-table__sub">Room {r.room_number}</p>
                  </td>
                  <td>{formatStamp(r.out_at)}</td>
                  <td>{r.still_out ? <em>Not back yet</em> : formatStamp(r.in_at)}</td>
                  <td>{formatDuration(r.duration_ms)}</td>
                  <td>{r.location ?? "—"}</td>
                  <td>
                    {r.still_out ? (
                      <span className={"badge badge--" + (r.late ? "danger" : "warn")}>{r.late ? "Overdue" : "Out"}</span>
                    ) : r.late ? (
                      <span className="badge badge--danger">Late</span>
                    ) : r.out_at ? (
                      <span className="badge badge--ok">On time</span>
                    ) : (
                      <span className="badge badge--neutral">Check-in only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > 300 && <p className="list-row__meta">Showing the latest 300. Export the report for the full list.</p>}
        </div>
      )}
    </section>
  );
}

// One QR poster per hostel. The QR is a plain URL (this app's /curfew route
// with the hostel's name and id) so any phone's stock camera app can read it.
// Each hostel also has its own GPS location + radius: the server only accepts
// a scan from a phone inside that circle. Set it by standing at the hostel
// entrance and pressing "Set location".
const DEFAULT_RADIUS_M = 150;

function HostelQrSection({ residences }) {
  const [locations, setLocations] = useState({});
  const [loadError, setLoadError] = useState("");

  const loadLocations = async () => {
    const { data, error } = await supabase.from("hostel_locations").select("*");
    if (error) {
      setLoadError(
        "Couldn't load hostel locations. Run supabase/migrations/2026-10-06_hostel_locations.sql in the Supabase SQL editor."
      );
      return;
    }
    setLoadError("");
    setLocations(Object.fromEntries((data ?? []).map((row) => [row.hostel_id, row])));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadLocations();
  }, []);

  return (
    <section style={{ marginBottom: "1rem" }}>
      <h3 className="panel-heading panel-heading--sub">Hostel QR Posters &amp; Locations</h3>
      <p className="tab__subtitle-text">
        Print each poster and put it at that hostel's entrance. Press "Set location" while you are
        standing at the entrance so scans from elsewhere are rejected.
      </p>
      {loadError && <p className="message message--error">{loadError}</p>}
      <div className="qr-grid">
        {residences.map((r) => (
          <HostelQrCard key={r.id} hostel={r} location={locations[r.id]} onSaved={loadLocations} />
        ))}
      </div>
    </section>
  );
}

function HostelQrCard({ hostel, location, onSaved }) {
  const [dataUrl, setDataUrl] = useState("");
  const [radiusEdit, setRadiusEdit] = useState(null);
  const radius = radiusEdit ?? location?.radius_m ?? DEFAULT_RADIUS_M;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const url = `${window.location.origin}${assetUrl("curfew")}?loc=${encodeURIComponent(hostel.name)}&h=${encodeURIComponent(hostel.id)}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = (await import("qrcode")).default;
      const png = await QRCode.toDataURL(url, { width: 480, margin: 2 });
      if (!cancelled) setDataUrl(png);
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  // A printable poster: hostel name on top, QR below, instruction underneath.
  const downloadPoster = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 820;
      const g = c.getContext("2d");
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = "#1f2a33";
      g.textAlign = "center";
      g.font = "600 26px sans-serif";
      g.fillText("DormSphere Curfew", 320, 62);
      g.font = "800 42px sans-serif";
      g.fillText(hostel.name, 320, 125, 580);
      g.drawImage(img, 80, 160, 480, 480);
      g.font = "600 28px sans-serif";
      g.fillText("Scan to check in / out", 320, 700);
      g.font = "400 20px sans-serif";
      g.fillStyle = "#5e6a73";
      g.fillText("Log in to DormSphere on your phone once first", 320, 740);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = `curfew-poster-${hostel.id}.png`;
      a.click();
    };
    img.src = dataUrl;
  };

  const saveLocation = async () => {
    setBusy(true);
    setMessage("");
    try {
      const pos = await getCurrentPosition();
      const { error } = await supabase.from("hostel_locations").upsert({
        hostel_id: hostel.id,
        name: hostel.name,
        latitude: pos.latitude,
        longitude: pos.longitude,
        radius_m: Math.max(20, Math.min(2000, Number(radius) || DEFAULT_RADIUS_M)),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      setMessage(`Location saved (accuracy about ${Math.round(pos.accuracy)} m).`);
      onSaved?.();
    } catch (err) {
      setMessage(err.message);
    }
    setBusy(false);
  };

  return (
    <div className="glass-panel qr-card">
      <p className="list-row__title">{hostel.name}</p>
      <span className={"badge badge--" + (location ? "ok" : "warn")}>
        {location ? "Location set" : "Location not set"}
      </span>
      {!location && (
        <p className="list-row__meta">Scans from this hostel are accepted from anywhere until a location is set.</p>
      )}

      {dataUrl ? (
        <img className="qr-card__img" src={dataUrl} alt={`Curfew QR for ${hostel.name}`} />
      ) : (
        <p className="list-row__meta">Generating…</p>
      )}

      <button type="button" className="primary-btn btn-sm" disabled={!dataUrl} onClick={downloadPoster}>
        <DownloadIcon aria-hidden="true" /> Download poster
      </button>

      <label className="field">
        <span className="field__label">Allowed radius (metres)</span>
        <input
          type="number"
          min="20"
          max="2000"
          value={radius}
          onChange={(e) => setRadiusEdit(e.target.value)}
        />
      </label>
      <button type="button" className="link-btn" disabled={busy} onClick={saveLocation}>
        <MapPinIcon aria-hidden="true" /> {busy ? "Getting location…" : location ? "Update location to where I am" : "Set location to where I am"}
      </button>
      {message && <p className="list-row__meta" role="status">{message}</p>}
    </div>
  );
}

export default WardenCurfewTab;
