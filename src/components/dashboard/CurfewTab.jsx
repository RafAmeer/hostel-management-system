import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function CurfewTab({ curfewLogs, studentId, onScanLogged }) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const lastScan = curfewLogs[0];
  const nextAction =
    lastScan?.scan_type === "check_out" ? "check_in" : "check_out";

  const handleScan = async () => {
    setSubmitting(true);
    setMessage("");

    const { error } = await supabase.from("curfew_logs").insert({
      student_id: studentId,
      scan_type: nextAction,
    });

    setSubmitting(false);

    if (error) {
      setMessage(`Couldn't log scan: ${error.message}`);
      return;
    }

    setMessage(`Logged: ${nextAction.replace("_", " ")}`);
    onScanLogged?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Curfew Check-In</h2>
      <p className="tab__subtitle-text">
        This button stands in for the entrance QR scanner — swap it for a
        real html5-qrcode reader once the hardware/kiosk is set up.
      </p>

      <button
        className="primary-btn primary-btn--wide"
        onClick={handleScan}
        disabled={submitting}
      >
        {submitting
          ? "Logging…"
          : nextAction === "check_out"
          ? "Log Check-Out"
          : "Log Check-In"}
      </button>
      {message && <p className="tab__message">{message}</p>}

      <h3 className="tab__subtitle">Recent Scans</h3>
      <div className="list">
        {curfewLogs.map((log) => (
          <div key={log.id} className="list-row">
            <p className="list-row__title">
              {log.scan_type.replace("_", " ")}
            </p>
            <p className="list-row__meta">{log.timestamp}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CurfewTab;