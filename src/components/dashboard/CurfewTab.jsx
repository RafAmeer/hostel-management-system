import { useEffect, useMemo, useState } from "react";
import CurfewScanCard from "./CurfewScanCard";
import { formatDateTime } from "../../lib/formatters";
import { getDeviceOwnership, releaseDevice } from "../../lib/deviceBinding";
import { isPhoneDevice } from "../../lib/device";
import ClearHistoryButton from "./ClearHistoryButton";
import { useClearedHistory } from "../../lib/clearedHistory";
import { buildMovementRecords, curfewLabel, isPastCurfew, MAX_OUT_HOURS } from "../../lib/curfew";

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
  const lastLog = curfewLogs[0]; // current status always uses the real latest scan
  const history = useClearedHistory("curfew", userId);
  const { shown: visibleLogs, hidden: hiddenLogs, clearable } = history.view(curfewLogs);
  const isOut = lastLog?.scan_type === "check_out";

  // Each scan is compared against the curfew deadline (proposal: "system
  // timestamps each scan and compares against curfew deadline"), using the
  // same rule the warden's Curfew tab uses (lib/curfew.js): a return is
  // late if it happens during curfew hours or after more than
  // MAX_OUT_HOURS out. Keyed by the check-in scan's timestamp.
  const returns = useMemo(() => {
    const map = new Map();
    for (const r of buildMovementRecords(curfewLogs, [])) {
      if (!r.out_at || !r.in_at) continue;
      map.set(r.in_at, {
        late: r.late,
        reason: isPastCurfew(new Date(r.in_at)) ? "Returned after curfew" : `Out over ${MAX_OUT_HOURS} hours`,
      });
    }
    return map;
  }, [curfewLogs]);

  // The clock ticks once a minute so "overdue" appears without a refresh.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const pastCurfew = isPastCurfew(now);
  const outTooLong = isOut && now.getTime() - new Date(lastLog.timestamp).getTime() > MAX_OUT_HOURS * 60 * 60 * 1000;
  const overdue = isOut && (pastCurfew || outTooLong);
  const statusLabel = !lastLog ? "No scans yet" : overdue ? "Out — Overdue" : isOut ? "Out of Hostel" : "In Hostel";
  const statusTone = !lastLog ? "neutral" : overdue ? "danger" : isOut ? "warn" : "ok";

  return (
    <div className="tab">
      <h2 className="tab__title">Curfew</h2>

      <div className="glass-panel curfew-status">
        <div>
          <p className="list-row__meta">Current status</p>
          <p className="curfew-status__value">
            <span className={"badge badge--" + statusTone}>{statusLabel}</span>
          </p>
          {lastLog && <p className="list-row__meta">Last scan: {formatDateTime(lastLog.timestamp)}</p>}
          {overdue && (
            <p className="list-row__meta text-danger">
              {pastCurfew ? "It's past curfew." : `You've been out over ${MAX_OUT_HOURS} hours.`} Please check in when you're back.
            </p>
          )}
          <p className="list-row__meta">
            Curfew: {curfewLabel()} · maximum {MAX_OUT_HOURS} hours out
          </p>
        </div>
      </div>

      <CurfewScanCard />
      <DeviceCard userId={userId} />

      <h3 className="panel-heading panel-heading--sub">Scan History</h3>
      <ClearHistoryButton
        canClear={clearable.length > 0}
        hidden={hiddenLogs}
        showAll={history.showAll}
        onClear={() => history.clear(clearable)}
        onToggleShowAll={history.toggleShowAll}
        note="Clearing only hides your scan list here. The hostel keeps its curfew records."
      />
      {visibleLogs.length === 0 ? (
        <p className="tab__empty">{curfewLogs.length === 0 ? "No curfew scans yet." : "History cleared."}</p>
      ) : (
        <div className="list">
          {visibleLogs.map((log) => {
            const ret = log.scan_type === "check_in" ? returns.get(log.timestamp) : null;
            return (
              <div key={log.id} className="list-row">
                <div>
                  <p className="list-row__title">{log.scan_type === "check_out" ? "Check Out" : "Check In"}</p>
                  {log.location && <p className="list-row__meta">{log.location}</p>}
                  {ret?.late && <p className="list-row__meta text-danger">{ret.reason}</p>}
                </div>
                <div className="list-row__actions">
                  {ret && (
                    <span className={"badge badge--" + (ret.late ? "danger" : "ok")}>{ret.late ? "Late" : "On time"}</span>
                  )}
                  <p className="list-row__meta">{formatDateTime(log.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CurfewTab;
