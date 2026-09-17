import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Manual Check-In/Check-Out button stands in for the actual QR scan step
// from the proposal (html5-qrcode isn't wired up yet) — swap handleScan's
// insert for a real scanned-code read once that library is added.
function CurfewTab({ curfewLogs, studentId, onScanLogged }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const lastLog = curfewLogs[0];
  const isOut = lastLog?.scan_type === "check_out";
  const nextType = isOut ? "check_in" : "check_out";

  const handleScan = async () => {
    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.from("curfew_logs").insert({
      student_id: studentId,
      scan_type: nextType,
      timestamp: new Date().toISOString(),
    });

    setSubmitting(false);

    if (error) {
      setMessage(`Couldn't log scan: ${error.message}`);
      return;
    }

    onScanLogged?.();
  };

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
        </div>
        {message && <p className="tab__message">{message}</p>}
        <button
          type="button"
          className="primary-btn primary-btn--wide"
          disabled={submitting}
          onClick={handleScan}
        >
          {submitting
            ? "Logging…"
            : nextType === "check_out"
            ? "Log Check-Out"
            : "Log Check-In"}
        </button>
      </div>

      <h3 className="panel-heading panel-heading--sub">Scan History</h3>
      {curfewLogs.length === 0 ? (
        <p className="tab__empty">No curfew scans yet.</p>
      ) : (
        <div className="list">
          {curfewLogs.map((log) => (
            <div key={log.id} className="list-row">
              <p className="list-row__title">
                {log.scan_type === "check_out" ? "Check Out" : "Check In"}
              </p>
              <p className="list-row__meta">{log.timestamp}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CurfewTab;
