// Client-side aggregation for the Warden "AI-assisted analytics" panel.
//
// Counts, category breakdowns, and period-over-period trends are computed
// HERE in JS (fast, free, always correct) — never by the AI. The AI's only
// job (see lib/aiSummary.js / supabase/functions/ai-summary) is to turn
// this already-correct data into a short written narrative. This keeps
// the numbers a warden relies on guaranteed accurate regardless of what
// the language model does.

const DAY_MS = 24 * 60 * 60 * 1000;

function withinRange(dateStr, start, end) {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}

function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

function countBy(items, key) {
  const out = {};
  for (const item of items) {
    const k = item[key] ?? "Unknown";
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// periodDays: how many trailing days count as the "current" period (7, 30, ...).
// Pass null for "all time" — totals are still returned, but there's no
// previous period to compare against, so `trends` comes back null.
//
// `rooms` and `students` are optional (older callers that only pass
// bookings/complaints/curfewStatuses still work) — when given, they add
// occupancy + registration counts that the chatbot needs to answer
// questions like "how many students are registered" or "how many rooms
// are full" without the model ever guessing a number itself.
export function buildHostelAnalytics({ bookings, complaints, curfewStatuses, rooms = [], students = [], periodDays = 7 }) {
  const now = new Date();
  const currentStart = periodDays ? new Date(now.getTime() - periodDays * DAY_MS) : null;
  const previousStart = periodDays ? new Date(currentStart.getTime() - periodDays * DAY_MS) : null;

  const inCurrent = (item) => !periodDays || withinRange(item.created_at, currentStart, now);
  const inPrevious = (item) => periodDays && withinRange(item.created_at, previousStart, currentStart);

  const currentBookings = bookings.filter(inCurrent);
  const previousBookings = periodDays ? bookings.filter(inPrevious) : [];
  const currentComplaints = complaints.filter(inCurrent);
  const previousComplaints = periodDays ? complaints.filter(inPrevious) : [];

  const bookingsByStatus = countBy(currentBookings, "status");
  const complaintsByStatus = countBy(currentComplaints, "status");
  const complaintsByCategory = countBy(currentComplaints, "category");

  const studentsOut = curfewStatuses.filter((c) => c.status !== "checked_in").length;
  const overdue = curfewStatuses.filter((c) => c.status === "overdue").length;

  const topCategoryEntry = Object.entries(complaintsByCategory).sort((a, b) => b[1] - a[1])[0];

  const totalCapacity = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
  const totalOccupied = rooms.reduce((sum, r) => sum + (r.occupied_count ?? 0), 0);
  const fullRooms = rooms.filter((r) => r.occupied_count >= r.capacity).length;

  return {
    dateRange: periodDays
      ? {
          start: currentStart.toISOString().slice(0, 10),
          end: now.toISOString().slice(0, 10),
          days: periodDays,
        }
      : { start: null, end: now.toISOString().slice(0, 10), days: null, label: "All time" },
    totals: {
      bookings: currentBookings.length,
      complaints: currentComplaints.length,
      studentsCurrentlyOut: studentsOut,
      overdueCurfews: overdue,
      registeredStudents: students.length,
      totalRooms: rooms.length,
      totalCapacity,
      totalOccupied,
      availableCapacity: totalCapacity - totalOccupied,
      fullRooms,
    },
    bookingsByStatus,
    complaintsByStatus,
    complaintsByCategory,
    topComplaintCategory: topCategoryEntry
      ? { category: topCategoryEntry[0], count: topCategoryEntry[1] }
      : null,
    trends: periodDays
      ? {
          bookings: {
            current: currentBookings.length,
            previous: previousBookings.length,
            pctChange: pctChange(currentBookings.length, previousBookings.length),
          },
          complaints: {
            current: currentComplaints.length,
            previous: previousComplaints.length,
            pctChange: pctChange(currentComplaints.length, previousComplaints.length),
          },
        }
      : null,
  };
}
