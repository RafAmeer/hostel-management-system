// Fixed shuttle timetable helpers. The warden maintains a list of trips
// (transport_schedule rows); students only read it. No booking, no approval.
import { ACTIVE_BOOKING_STATUSES } from "./semesters";
import { isOffCampus, residenceForBooking } from "./hostelOf";

// JS getDay() order: 0 = Sunday ... 6 = Saturday.
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const DIRECTIONS = {
  to_campus: "Hostel → Campus",
  to_hostel: "Campus → Hostel",
};

// "06:45:00" or "06:45" -> "6:45 AM"
export function formatTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? ""));
  if (!m) return String(value ?? "");
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${suffix}`;
}

// "06:45:00" -> "06:45" (what <input type="time"> wants)
export const toInputTime = (value) => String(value ?? "").slice(0, 5);

// Human summary of a days array: [1,2,3,4,5] -> "Mon–Fri", [1,3] -> "Mon, Wed".
export function describeDays(days) {
  const set = [...new Set(days ?? [])].sort((a, b) => a - b);
  if (set.length === 0) return "No days set";
  if (set.length === 7) return "Every day";
  if (set.join() === WEEKDAYS.join()) return "Mon–Fri";
  if (set.join() === "0,6") return "Weekends";
  return set.map((d) => DAY_SHORT[d]).join(", ");
}

const byTime = (a, b) => String(a.departure_time).localeCompare(String(b.departure_time));

export function tripsForDay(schedule, day) {
  return (schedule ?? [])
    .filter((t) => t.active !== false && (t.days ?? []).includes(day))
    .sort(byTime);
}

// First trip still to come today (HH:MM compare), or null.
export function nextTrip(trips, now = new Date()) {
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return trips.find((t) => toInputTime(t.departure_time) >= hhmm) ?? null;
}

// Which hostels' trips matter to this student?
//  - live booking at an off-campus hostel -> only those hostels
//  - live booking only at main campus      -> no shuttle needed
//  - no live booking yet                   -> everything (so they can browse)
export function studentTransportScope(bookings, rooms, residences) {
  const live = (bookings ?? []).filter((b) => ACTIVE_BOOKING_STATUSES.includes(b.status));
  const offCampus = live
    .map((b) => residenceForBooking(b, rooms, residences))
    .filter((r) => isOffCampus(r));
  if (offCampus.length > 0) return { mode: "hostels", hostelIds: [...new Set(offCampus.map((r) => r.id))] };
  if (live.length > 0) return { mode: "none", hostelIds: [] };
  return { mode: "all", hostelIds: [] };
}

export function scopeSchedule(schedule, scope) {
  if (scope.mode === "none") return [];
  if (scope.mode === "hostels") return schedule.filter((t) => scope.hostelIds.includes(t.hostel_id));
  return schedule;
}
