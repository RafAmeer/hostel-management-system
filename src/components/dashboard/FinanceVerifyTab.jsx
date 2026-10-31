import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import { FINANCE_LABELS, financeTone, formatDateTime } from "../../lib/formatters";

const FILTERS = [
  { value: "pending", label: "Waiting" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Not verified" },
  { value: "all", label: "All" },
];

// Finance Module: every new student account lands here as "Awaiting
// Finance". Finance checks the student (e.g. fees / deposit on record) and
// marks them Verified or Not verified. Only verified students can request a
// room — the database enforces that too (bookings_insert policy), so this
// screen is the single place the decision is made.
function FinanceVerifyTab({ students, payments = [], onDecide }) {
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const c = { pending: 0, verified: 0, rejected: 0, all: students.length };
    students.forEach((s) => {
      const k = s.finance_status ?? "pending";
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [students]);

  // Outstanding / overdue payment totals per student, to help the decision.
  const owing = useMemo(() => {
    const map = new Map();
    payments
      .filter((p) => p.student_id && p.status !== "paid")
      .forEach((p) => map.set(p.student_id, (map.get(p.student_id) ?? 0) + Number(p.amount ?? 0)));
    return map;
  }, [payments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => filter === "all" || (s.finance_status ?? "pending") === filter)
      .filter((s) =>
        !q
          ? true
          : [s.full_name, s.student_id, s.programme, s.phone]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
  }, [students, filter, query]);

  const decide = async (student, status) => {
    setError("");
    setBusyId(student.id);
    try {
      await onDecide(student.id, status, notes[student.id] ?? "");
      setNotes((n) => ({ ...n, [student.id]: "" }));
    } catch (e) {
      setError(e.message ?? "Couldn't save. Please try again.");
    }
    setBusyId(null);
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Verify Students</h2>
      <p className="list-row__meta finance-verify__intro">
        New students can't request a room until Finance verifies their account.
      </p>

      <div className="stat-mini-row">
        <div className="stat-mini">
          <strong>{counts.pending}</strong>
          <span>Waiting</span>
        </div>
        <div className="stat-mini">
          <strong>{counts.verified}</strong>
          <span>Verified</span>
        </div>
        <div className="stat-mini">
          <strong>{counts.rejected}</strong>
          <span>Not verified</span>
        </div>
      </div>

      <div className="students-toolbar">
        <input
          type="search"
          className="students-toolbar__search"
          placeholder="Search name, student ID, programme or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search students"
        />
        <div className="segmented" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={"segmented__btn" + (filter === f.value ? " segmented__btn--active" : "")}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {f.value !== "all" && counts[f.value] ? ` (${counts[f.value]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="tab__empty">
          {filter === "pending" ? "No students are waiting for verification. 🎉" : "No students match."}
        </p>
      ) : (
        <div className="list">
          {filtered.map((s) => {
            const status = s.finance_status ?? "pending";
            const due = owing.get(s.id) ?? 0;
            const busy = busyId === s.id;
            return (
              <div key={s.id} className="list-row finance-verify__row">
                <div className="students-table__person">
                  <Avatar url={s.avatar_url} name={s.full_name} size={40} />
                  <div>
                    <p className="list-row__title">
                      {s.full_name ?? "Profile not filled in yet"}{" "}
                      <span className="students-table__sub">{s.student_id ?? ""}</span>
                    </p>
                    <p className="list-row__meta">
                      {[s.programme, s.semester, s.phone].filter(Boolean).join(" · ") || "No details yet"}
                    </p>
                    <p className="list-row__meta">
                      Signed up {formatDateTime(s.created_at)}
                      {due > 0 ? (
                        <>
                          {" · "}
                          <mark className="hl">RM {due.toFixed(2)} outstanding</mark>
                        </>
                      ) : null}
                    </p>
                    {status !== "pending" && s.finance_note ? (
                      <p className="list-row__meta">Note: {s.finance_note}</p>
                    ) : null}
                  </div>
                </div>

                <div className="finance-verify__actions">
                  <span className={"badge badge--" + financeTone(status)}>{FINANCE_LABELS[status] ?? status}</span>
                  {status === "pending" ? (
                    <>
                      <input
                        type="text"
                        className="finance-verify__note"
                        placeholder="Note to student (optional)"
                        value={notes[s.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                        aria-label={`Note for ${s.full_name ?? "student"}`}
                        maxLength={200}
                      />
                      <div className="finance-verify__buttons">
                        <button type="button" className="primary-btn btn-sm" disabled={busy} onClick={() => decide(s, "verified")}>
                          {busy ? "Saving…" : "Verify"}
                        </button>
                        <button type="button" className="btn-outline btn-sm" disabled={busy} onClick={() => decide(s, "rejected")}>
                          Reject
                        </button>
                      </div>
                    </>
                  ) : (
                    <button type="button" className="link-btn" disabled={busy} onClick={() => decide(s, "pending")}>
                      Undo
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FinanceVerifyTab;
