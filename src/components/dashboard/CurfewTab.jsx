import { useState } from "react";
import CurfewScanCard from "./CurfewScanCard";
import { formatDateTime } from "../../lib/formatters";
import { getDeviceOwnership, releaseDevice } from "../../lib/deviceBinding";
import { isPhoneDevice } from "../../lib/device";

// Which phone is allowed to scan for this student. One phone per student
// and one student per phone (see lib/deviceBinding.js).
function DeviceCard({ userId }) {
  const [, refresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (!isPhoneDevice()) return null;
  const ownership = getDeviceOwnership(userId);

  const release = async () => {
    setBusy(true);
    const res = await releaseDevice();
    setBusy(false);
    setNote(res.ok ? "This phone was released. Log in again here to register it." : res.message);
    refresh((n) => n + 1);
  };

  return (
    <section className="glass-panel scan-card device-card">
      <div className="scan-card__text">
        <h3 className="scan-card__title">This phone</h3>
        <p className="scan-card__sub">
          {ownership === "mine" &&
            "Registered for your curfew scans. Only one phone can be registered to you at a time — logging in on another phone moves the registration there."}
          {ownership === "other" &&
            "This phone is already registered to another student, so it can't scan for you. Use your own phone, or ask the other student to release it."}
          {ownership === "none" &&
            "Not registered for curfew scans yet. Log out and log in again on this phone to register it."}
        </p>
        {note && <p className="list-row__meta">{note}</p>}
      </div>
      {ownership === "mine" && (
        <button type="button" className="btn-outline btn-outline--neutral" disabled={busy} onClick={release}>
          {busy ? "Releasing…" : "Release this phone"}
        </button>
      )}
    </section>
  );
}

// Student Curfew tab: current status, the Scan Curfew entry point (phone
// only) and scan history. Check-in/out itself happens on the /curfew page
// (camera + GPS check) — there is no manual button any more, so a scan
// can't be logged from a desktop or from outside the hostel.
function CurfewTab({ curfewLogs, userId }) {
  const lastLog = curfewLogs[0];
  const isOut = lastLog?.scan_type === "check_out";

  return (
    <div className="tab">
      <h2 className="tab__title">Curfew</h2>

      <div className="glass-panel curfew-status">
        <div>
          <p className="list-row__meta">Current status</p>
          <p className="curfew-status__value">
            <span className={"badge badge--" + (isOut ? "warn" : "ok")}>
              {isOut ? "Out of Hostel" : "In Hostel"}
            </span>
          </p>
          {lastLog && <p className="list-row__meta">Last scan: {formatDateTime(lastLog.timestamp)}</p>}
        </div>
      </div>

      <CurfewScanCard />
      <DeviceCard userId={userId} />

      <h3 className="panel-heading panel-heading--sub">Scan History</h3>
      {curfewLogs.length === 0 ? (
        <p className="tab__empty">No curfew scans yet.</p>
      ) : (
        <div className="list">
          {curfewLogs.map((log) => (
            <div key={log.id} className="list-row">
              <div>
                <p className="list-row__title">{log.scan_type === "check_out" ? "Check Out" : "Check In"}</p>
                {log.location && <p className="list-row__meta">{log.location}</p>}
              </div>
              <p className="list-row__meta">{formatDateTime(log.timestamp)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CurfewTab;
