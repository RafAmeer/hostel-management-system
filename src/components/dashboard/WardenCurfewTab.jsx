import { useEffect, useState } from "react";
import { assetUrl } from "../../lib/assetUrl";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentPosition } from "../../lib/geo";
import { MapPinIcon, DownloadIcon } from "./icons";

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

function WardenCurfewTab({ curfewStatuses, onCheckIn, residences = [] }) {
  return (
    <div className="tab">
      <h2 className="tab__title">Curfew</h2>
      <p className="tab__subtitle-text">
        Live check-out/check-in status per student. Every hostel has its own QR poster and
        its own location (below) — students scan the poster at their hostel entrance.
        "Log Check-In" is a manual override for wardens.
      </p>

      <HostelQrSection residences={residences} />

      <h3 className="panel-heading panel-heading--sub">Student Status</h3>
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
