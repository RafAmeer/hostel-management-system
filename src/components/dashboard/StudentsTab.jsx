import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import { ELIGIBILITY_LABELS, eligibilityTone, FINANCE_LABELS, financeTone } from "../../lib/formatters";

const ELIGIBILITY_FILTERS = [
  { value: "all", label: "All eligibility" },
  { value: "eligible", label: "Eligible" },
  { value: "pending", label: "Pending" },
  { value: "not_eligible", label: "Not eligible" },
];

const HOSTEL_FILTERS = [
  { value: "all", label: "In or out of hostel" },
  { value: "in", label: "Staying in hostel" },
  { value: "out", label: "Not staying in hostel" },
];

// Warden view of every registered student: who they are, what they study,
// whether they live in the hostel, and their eligibility — with the
// warden's override (proposal: "override eligibility"). Data comes from the
// `profiles` rows the dashboard already loads for role = "student".
function StudentsTab({ students, bookings = [], onEligibilityChange }) {
  const [query, setQuery] = useState("");
  const [eligibility, setEligibility] = useState("all");
  const [hostel, setHostel] = useState("all");

  // Latest approved room per student, as a fallback when profiles.room_number is empty.
  const approvedRoomByStudent = useMemo(() => {
    const map = new Map();
    bookings
      .filter((b) => b.status === "approved")
      .forEach((b) => {
        if (!map.has(b.student_id)) map.set(b.student_id, b.room_number);
      });
    return map;
  }, [bookings]);

  const counts = useMemo(
    () => ({
      total: students.length,
      inHostel: students.filter((s) => s.in_hostel === true).length,
      eligible: students.filter((s) => s.eligibility_status === "eligible").length,
      pending: students.filter((s) => !s.eligibility_status || s.eligibility_status === "pending").length,
    }),
    [students]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => {
        const status = s.eligibility_status ?? "pending";
        if (eligibility !== "all" && status !== eligibility) return false;
        if (hostel === "in" && s.in_hostel !== true) return false;
        if (hostel === "out" && s.in_hostel !== false) return false;
        if (!q) return true;
        return [s.full_name, s.student_id, s.programme, s.phone, s.room_number]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [students, query, eligibility, hostel]);

  const handleSelect = (student, value) => {
    onEligibilityChange?.(student.id, value === "auto" ? null : value);
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Students</h2>

      <div className="stat-mini-row">
        <div className="stat-mini">
          <strong>{counts.total}</strong>
          <span>Registered</span>
        </div>
        <div className="stat-mini">
          <strong>{counts.inHostel}</strong>
          <span>In hostel</span>
        </div>
        <div className="stat-mini">
          <strong>{counts.eligible}</strong>
          <span>Eligible</span>
        </div>
        <div className="stat-mini">
          <strong>{counts.pending}</strong>
          <span>Pending</span>
        </div>
      </div>

      <div className="students-toolbar">
        <input
          type="search"
          className="students-toolbar__search"
          placeholder="Search name, student ID, programme, phone or room"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search students"
        />
        <select value={eligibility} onChange={(e) => setEligibility(e.target.value)} aria-label="Filter by eligibility">
          {ELIGIBILITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={hostel} onChange={(e) => setHostel(e.target.value)} aria-label="Filter by hostel status">
          {HOSTEL_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {students.length === 0 ? (
        <p className="tab__empty">No students have registered yet.</p>
      ) : filtered.length === 0 ? (
        <p className="tab__empty">No students match your search.</p>
      ) : (
        <div className="glass-panel students-table-wrap">
          <table className="students-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Programme</th>
                <th>Semester</th>
                <th>Gender</th>
                <th>Contact</th>
                <th>Hostel</th>
                <th>Eligibility</th>
                <th>Finance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const status = s.eligibility_status ?? "pending";
                const room = s.room_number || approvedRoomByStudent.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="students-table__person">
                        <Avatar url={s.avatar_url} name={s.full_name} size={36} />
                        <div>
                          <p className="students-table__name">{s.full_name ?? "Unnamed student"}</p>
                          <p className="students-table__sub">{s.student_id ?? "No ID yet"}</p>
                        </div>
                      </div>
                    </td>
                    <td>{s.programme ?? "—"}</td>
                    <td>{s.semester ?? "—"}</td>
                    <td className="students-table__cap">{s.gender ?? "—"}</td>
                    <td>
                      <p>{s.phone ?? "—"}</p>
                      {s.age ? <p className="students-table__sub">Age {s.age}</p> : null}
                    </td>
                    <td>
                      {s.in_hostel === true ? (
                        <>
                          <span className="badge badge--ok">In hostel</span>
                          {room ? <p className="students-table__sub">Room {room}</p> : null}
                        </>
                      ) : s.in_hostel === false ? (
                        <span className="badge badge--danger">Not in hostel</span>
                      ) : (
                        <span className="badge badge--neutral">Unknown</span>
                      )}
                    </td>
                    <td>
                      <span className={"badge badge--" + eligibilityTone(status)}>
                        {ELIGIBILITY_LABELS[status] ?? status}
                      </span>
                      {s.eligibility_override ? <p className="students-table__sub">Set by warden</p> : null}
                      <select
                        className="students-table__select"
                        value={s.eligibility_override ? status : "auto"}
                        onChange={(e) => handleSelect(s, e.target.value)}
                        aria-label={`Eligibility for ${s.full_name ?? "student"}`}
                      >
                        <option value="auto">Automatic</option>
                        <option value="eligible">Force eligible</option>
                        <option value="not_eligible">Force not eligible</option>
                      </select>
                    </td>
                    <td>
                      <span className={"badge badge--" + financeTone(s.finance_status ?? "pending")}>
                        {FINANCE_LABELS[s.finance_status ?? "pending"]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default StudentsTab;
