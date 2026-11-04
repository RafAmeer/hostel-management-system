// Curfew helpers shared by the warden Curfew tab, Overview, alerts and
// reports. Everything is worked out from raw curfew_logs rows (one row per
// QR scan), so there's a single source of truth.

// Hostel curfew: students should be back by CURFEW_HOUR (24h clock). Anyone
// still checked out after that — or out longer than MAX_OUT_HOURS at any
// time of day — counts as overdue.
export const CURFEW_HOUR = 23;
export const CURFEW_END_HOUR = 6;
export const MAX_OUT_HOURS = 4;

const HOUR = 60 * 60 * 1000;

export function isPastCurfew(date = new Date()) {
  const h = date.getHours();
  return h >= CURFEW_HOUR || h < CURFEW_END_HOUR;
}

export function curfewLabel() {
  const fmt = (h) => new Date(2000, 0, 1, h).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
  return `${fmt(CURFEW_HOUR)} – ${fmt(CURFEW_END_HOUR)}`;
}

export function formatDuration(ms) {
  if (ms == null || ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

const time = (iso) => new Date(iso).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });

// One current-status row per student who is OUT right now (their latest
// scan is a check-out). Same shape the Overview/Curfew tabs already used.
export function curfewStatusesFromLogs(logs, students, now = new Date()) {
  const latestByStudent = new Map();
  for (const log of logs) {
    const existing = latestByStudent.get(log.student_id);
    if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
      latestByStudent.set(log.student_id, log);
    }
  }
  const studentsById = new Map(students.map((s) => [s.id, s]));

  return Array.from(latestByStudent.entries())
    .filter(([, log]) => log.scan_type === "check_out")
    .map(([studentId, log]) => {
      const student = studentsById.get(studentId);
      const outMs = now.getTime() - new Date(log.timestamp).getTime();
      const tooLong = outMs > MAX_OUT_HOURS * HOUR;
      const afterCurfew = isPastCurfew(now);
      const overdue = tooLong || afterCurfew;
      return {
        id: studentId,
        student_name: student?.full_name ?? "Unknown",
        room_number: student?.room_number ?? "—",
        phone: student?.phone ?? null,
        emergency_name: student?.emergency_name ?? null,
        emergency_phone: student?.emergency_phone ?? null,
        location: log.location ?? null,
        out_since: log.timestamp,
        out_for_ms: outMs,
        check_out_time: time(log.timestamp),
        check_in_time: null,
        status: overdue ? "overdue" : "out",
        overdue_reason: overdue ? (afterCurfew ? "Past curfew" : `Out over ${MAX_OUT_HOURS} hours`) : null,
      };
    })
    .sort((a, b) => (a.status === b.status ? b.out_for_ms - a.out_for_ms : a.status === "overdue" ? -1 : 1));
}

// Student movement records: pairs each check-out with the next check-in
// for the same student. A check-out with no check-in yet is "still out";
// a lone check-in (e.g. first scan was a check-in) is kept as its own row.
export function buildMovementRecords(logs, students) {
  const studentsById = new Map(students.map((s) => [s.id, s]));
  const byStudent = new Map();
  for (const log of logs) {
    if (!byStudent.has(log.student_id)) byStudent.set(log.student_id, []);
    byStudent.get(log.student_id).push(log);
  }

  const rows = [];
  for (const [studentId, list] of byStudent) {
    const s = studentsById.get(studentId);
    const sorted = [...list].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let openOut = null;
    const push = (out, back) => {
      const outAt = out?.timestamp ?? null;
      const inAt = back?.timestamp ?? null;
      const end = inAt ? new Date(inAt) : new Date();
      const duration = outAt ? end - new Date(outAt) : null;
      const lateReturn =
        (inAt && isPastCurfew(new Date(inAt))) || (duration != null && duration > MAX_OUT_HOURS * HOUR);
      rows.push({
        key: `${studentId}-${outAt ?? inAt}`,
        student_id: studentId,
        student_name: s?.full_name ?? "Unknown",
        student_no: s?.student_id ?? "",
        room_number: s?.room_number ?? "—",
        location: out?.location ?? back?.location ?? null,
        out_at: outAt,
        in_at: inAt,
        duration_ms: duration,
        still_out: Boolean(outAt && !inAt),
        late: Boolean(outAt && lateReturn),
        sortAt: outAt ?? inAt,
      });
    };
    for (const log of sorted) {
      if (log.scan_type === "check_out") {
        if (openOut) push(openOut, null); // two check-outs in a row: close the first as unknown
        openOut = log;
      } else {
        push(openOut, log);
        openOut = null;
      }
    }
    if (openOut) push(openOut, null);
  }
  // A "two check-outs in a row" row is not truly still out — only the last one is.
  const lastOutKey = new Map();
  rows.forEach((r) => {
    if (r.still_out) lastOutKey.set(r.student_id, r.key);
  });
  rows.forEach((r) => {
    if (r.still_out && lastOutKey.get(r.student_id) !== r.key) {
      r.still_out = false;
      r.duration_ms = null;
    }
  });
  return rows.sort((a, b) => new Date(b.sortAt) - new Date(a.sortAt));
}

export const formatStamp = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "—";
