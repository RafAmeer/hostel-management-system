import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ReportExportButton from "./ReportExportButton";
import { buildActivityReport } from "../../lib/buildReports";
import { formatStamp } from "../../lib/curfew";

const AREAS = [
  { key: "all", label: "Everything" },
  { key: "bookings", label: "Bookings" },
  { key: "complaints", label: "Complaints" },
  { key: "profiles", label: "Students" },
  { key: "rooms", label: "Rooms" },
  { key: "announcements", label: "Announcements" },
  { key: "payments", label: "Payments" },
  { key: "curfew_logs", label: "Curfew" },
];

const ROLE_TONE = { warden: "ok", finance: "warn", technician: "neutral", student: "neutral" };

// Audit trail (warden feedback: "record important actions performed in the
// system"). Rows are written by database triggers, not by the browser, so
// they can't be skipped or edited from the app — wardens can only read
// them (see the audit_logs RLS policies in the 2026-11-04 migration).
function WardenActivityTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [area, setArea] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error: err } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (err) setError("Couldn't load the activity log. Run supabase/migrations/2026-11-04_warden_feedback.sql first.");
      else {
        setError("");
        setLogs(data ?? []);
      }
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("audit-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, (payload) =>
        setLogs((prev) => [payload.new, ...prev].slice(0, 500))
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (area === "all" || l.table_name === area) &&
        (!q || [l.actor_name, l.action, l.summary].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    );
  }, [logs, area, query]);

  return (
    <div className="tab">
      <div className="tab__title-row">
        <h2 className="tab__title">Activity Log</h2>
        <ReportExportButton buildReport={() => buildActivityReport(shown)} />
      </div>
      <p className="tab__subtitle-text">
        Every important change — booking decisions, technician assignments, eligibility overrides, room changes,
        announcements and payments — is recorded automatically with who did it and when. Only wardens can see this
        page, and entries can't be edited or deleted.
      </p>

      <div className="students-toolbar">
        <input
          type="search"
          className="students-toolbar__search"
          placeholder="Search by person or action"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search activity"
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filter by area">
          {AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="message message--error">{error}</p>}
      {loading ? (
        <p className="tab__empty">Loading activity…</p>
      ) : shown.length === 0 ? (
        <p className="tab__empty">No activity recorded yet.</p>
      ) : (
        <ol className="activity-list">
          {shown.map((l) => (
            <li key={l.id} className="activity-item">
              <span className="activity-item__time">{formatStamp(l.created_at)}</span>
              <div className="activity-item__body">
                <p className="activity-item__action">{l.action}</p>
                {l.summary && <p className="list-row__meta">{l.summary}</p>}
              </div>
              <span className="activity-item__who">
                {l.actor_name ?? "System"}
                {l.actor_role && <span className={"badge badge--" + (ROLE_TONE[l.actor_role] ?? "neutral")}>{l.actor_role}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default WardenActivityTab;
