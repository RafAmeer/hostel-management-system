// Builds the bell's notification list from data each dashboard already
// loads, so no extra table is needed. Every item's `id` includes the state
// it describes (e.g. "booking-12-approved"), so a later change to the same
// row shows up as a new, unread notification.

const DAY = 24 * 60 * 60 * 1000;
const RECENT_DAYS = 30;

const when = (row) => row?.updated_at ?? row?.created_at ?? null;
const isRecent = (iso) => !iso || Date.now() - new Date(iso).getTime() < RECENT_DAYS * DAY;
const roomText = (r) => (r?.room_number ? `Room ${r.room_number}` : "your room");

const byNewest = (a, b) => new Date(b.at ?? 0) - new Date(a.at ?? 0);

export function buildStudentNotifications({ bookings = [], complaints = [], helpTickets = [], announcements = [] }) {
  const items = [];

  bookings.forEach((b) => {
    if (b.status === "approved")
      items.push({ id: `booking-${b.id}-approved`, tab: "bookings", tone: "ok", at: when(b), title: "Booking approved 🎉", body: `Your booking for ${roomText(b)} was approved.` });
    else if (b.status === "rejected")
      items.push({ id: `booking-${b.id}-rejected`, tab: "bookings", tone: "danger", at: when(b), title: "Booking rejected", body: `Your booking for ${roomText(b)} was not approved.` });
    else if (b.status === "cancelled")
      items.push({ id: `booking-${b.id}-cancelled`, tab: "bookings", tone: "neutral", at: when(b), title: "Booking cancelled", body: `Your booking for ${roomText(b)} was cancelled.` });
  });

  complaints.forEach((c) => {
    const what = c.category ? `Your ${String(c.category).toLowerCase()} complaint` : "Your complaint";
    if (c.status === "in_progress")
      items.push({ id: `complaint-${c.id}-in_progress`, tab: "complaints", tone: "warn", at: when(c), title: "Complaint in progress 🛠️", body: `${what} is being worked on.` });
    else if (c.status === "completed")
      items.push({ id: `complaint-${c.id}-completed`, tab: "complaints", tone: "ok", at: when(c), title: "Complaint fixed ✅", body: `${what} was marked as completed.` });
  });

  helpTickets.forEach((t) => {
    if (t.status === "answered")
      items.push({ id: `help-${t.id}-answered-${when(t) ?? ""}`, tab: "help", tone: "ok", at: when(t), title: "The warden replied 💬", body: `New reply on "${t.subject ?? "your request"}".` });
  });

  announcements.forEach((a) => {
    items.push({ id: `news-${a.id}`, tab: "overview", tone: a.pinned ? "warn" : "neutral", at: a.created_at, title: a.pinned ? "📌 Important announcement" : "📢 New announcement", body: a.title ?? "The hostel posted an update." });
  });

  return items.filter((i) => isRecent(i.at)).sort(byNewest);
}

export function buildWardenNotifications({ bookings = [], complaints = [], helpTickets = [], students = [] }) {
  const names = new Map(students.map((s) => [s.id, s.full_name]));
  const who = (id) => names.get(id) ?? "A student";
  const items = [];

  bookings.forEach((b) => {
    if (b.status === "pending")
      items.push({ id: `wbooking-${b.id}`, tab: "bookings", tone: "warn", at: b.created_at, title: "New booking request", body: `${who(b.student_id)} requested ${roomText(b)}.` });
  });

  complaints.forEach((c) => {
    if (c.status === "pending")
      items.push({ id: `wcomplaint-${c.id}`, tab: "complaints", tone: "danger", at: c.created_at, title: "New complaint", body: `${who(c.student_id)}: ${c.category ?? "new maintenance issue"}${c.room_number ? ` (Room ${c.room_number})` : ""}.` });
  });

  helpTickets.forEach((t) => {
    if (t.status === "open")
      items.push({ id: `whelp-${t.id}-${when(t) ?? ""}`, tab: "help", tone: "warn", at: when(t), title: "Student needs help", body: `${who(t.student_id)}: "${t.subject ?? "help request"}".` });
  });

  return items.filter((i) => isRecent(i.at)).sort(byNewest);
}
