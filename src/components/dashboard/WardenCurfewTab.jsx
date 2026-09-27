import { useState } from "react";

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
        Live check-out/check-in status per student. Students now scan the
        entrance QR poster themselves (see below) — "Log Check-In" here is a
        manual override for wardens, not the primary way students check in.
      </p>

      <EntranceQrGenerator />

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

// Generates the poster QR that goes at the physical entrance. Encodes a
// plain URL (this app's own /curfew route + ?loc=<label>) so any phone's
// stock camera app can scan it — no dedicated scanner app needed, and no
// camera permission required in this dashboard tab either, since QR
// generation (unlike scanning) needs no camera at all.
function EntranceQrGenerator() {
  const [label, setLabel] = useState("Main Entrance");
  const [dataUrl, setDataUrl] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    const QRCode = (await import("qrcode")).default;
    const url = `${window.location.origin}/curfew?loc=${encodeURIComponent(label)}`;
    const png = await QRCode.toDataURL(url, { width: 480, margin: 2 });
    setDataUrl(png);
    setGenerating(false);
  };

  return (
    <div className="glass-panel" style={{ marginBottom: "1rem" }}>
      <p className="list-row__title">Entrance QR Poster</p>
      <p className="tab__subtitle-text">
        Print this and post it at the hostel entrance. Students scan it with
        their phone's own camera — the app opens straight to check-in/out,
        no login needed after the first time on their phone.
      </p>
      <label className="field">
        <span className="field__label">Entrance label</span>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <button type="button" className="primary-btn" disabled={generating} onClick={generate}>
        {generating ? "Generating…" : "Generate QR"}
      </button>
      {dataUrl && (
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <img src={dataUrl} alt={`Curfew QR for ${label}`} style={{ maxWidth: "220px" }} />
          <div>
            <a className="portal-switch" href={dataUrl} download={`curfew-qr-${label}.png`}>
              Download PNG
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default WardenCurfewTab;
