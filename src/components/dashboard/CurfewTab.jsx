import CurfewScanCard from "./CurfewScanCard";
import { formatDateTime } from "../../lib/formatters";

// Student Curfew tab: current status, the Scan Curfew entry point (phone
// only) and scan history. Check-in/out itself happens on the /curfew page
// (camera + GPS check) — there is no manual button any more, so a scan
// can't be logged from a desktop or from outside the hostel.
function CurfewTab({ curfewLogs }) {
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
