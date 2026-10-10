// Semester labels look like "S1/2026", "S2/2026", "S3/2026" (three terms a
// year, same list the Complete Profile form offers).
const TERMS_PER_YEAR = 3;
export const FALLBACK_SEMESTER = "S2/2026";

export function parseSemester(label) {
  const m = /^S(\d)\/(\d{4})$/.exec(String(label ?? "").trim());
  if (!m) return null;
  return { term: Number(m[1]), year: Number(m[2]) };
}

// "S2/2026" -> "S3/2026", "S3/2026" -> "S1/2027". Anything unrecognised
// falls back to the term after the default one.
export function nextSemester(label) {
  const parsed = parseSemester(label) ?? parseSemester(FALLBACK_SEMESTER);
  if (parsed.term >= TERMS_PER_YEAR) return `S1/${parsed.year + 1}`;
  return `S${parsed.term + 1}/${parsed.year}`;
}

export const ACTIVE_BOOKING_STATUSES = ["pending", "approved"];

// A student may hold ONE live (pending or approved) booking per semester.
// A rejected/cancelled one doesn't count, so they can apply again.
export function activeBookingFor(bookings, semester) {
  return (
    (bookings ?? []).find(
      (b) => b.semester === semester && ACTIVE_BOOKING_STATUSES.includes(b.status)
    ) ?? null
  );
}
