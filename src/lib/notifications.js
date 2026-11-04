import { balanceOf, daysUntilDue, formatDue, money, paymentState } from "./payments";
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

export function buildStudentNotifications({ bookings = [], complaints = [], helpTickets = [], announcements = [], profile = null, payments = [] }) {
  const items = [];

  // Hostel fee reminders. The id carries the state (and Finance's latest
  // "send reminder" time), so going overdue or a new reminder from Finance
  // pops up as a fresh notification.
  payments.forEach((p) => {
    const state = paymentState(p);
    if (state === "paid") return;
    const bal = money(balanceOf(p));
    const days = daysUntilDue(p);
    if (state === "overdue")
      items.push({ id: `pay-${p.id}-overdue-${p.reminder_sent_at ?? ""}`, tab: "overview", tone: "danger", at: p.reminder_sent_at ?? new Date().toISOString(), title: "Hostel fee overdue 💳", body: `${bal} for ${p.semester ?? "hostel fees"} was due ${formatDue(p.due_date)}.` });
    else if (p.reminder_sent_at)
      items.push({ id: `pay-${p.id}-reminder-${p.reminder_sent_at}`, tab: "overview", tone: "warn", at: p.reminder_sent_at, title: "Payment reminder from Finance 💳", body: `${bal} is due ${formatDue(p.due_date)}.` });
    else if (days !== null && days <= 7)
      items.push({ id: `pay-${p.id}-due-soon`, tab: "overview", tone: "warn", at: new Date().toISOString(), title: "Hostel fee due soon 💳", body: `${bal} is due ${days === 0 ? "today" : `in ${days} day${days > 1 ? "s" : ""}`}.` });
  });

  // Finance verification of a new account (profiles.finance_status).
  if (profile?.finance_status === "verified" && profile.finance_verified_at)
    items.push({ id: `finance-verified-${profile.finance_verified_at}`, tab: "rooms", tone: "ok", at: profile.finance_verified_at, title: "Account verified ✅", body: "Finance verified your account. Room booking is open." });
  else if (profile?.finance_status === "rejected")
    items.push({ id: `finance-rejected-${profile.finance_verified_at ?? ""}`, tab: "overview", tone: "danger", at: profile.finance_verified_at, title: "Finance couldn't verify you", body: profile.finance_note || "Please visit the Finance office." });

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
    if (a.priority === "urgent") {
      items.push({ id: `news-${a.id}`, tab: "overview", tone: "danger", at: a.created_at, title: "🚨 Emergency notice", body: a.title ?? "Urgent message from the warden." });
      return;
    }
    items.push({ id: `news-${a.id}`, tab: "overview", tone: a.pinned ? "warn" : "neutral", at: a.created_at, title: a.pinned ? "📌 Important announcement" : "📢 New announcement", body: a.title ?? "The hostel posted an update." });
  });

  return items.filter((i) => isRecent(i.at)).sort(byNewest);
}

// Open this long = "unresolved" (matches WardenComplaintsTab).
const UNRESOLVED_AFTER_DAYS = 3;

// Warden alerts requested in user testing: overdue curfews, pending
// booking approvals, unresolved and urgent complaints, and a note when a
// technician resolves one — on top of new requests and help tickets.
export function buildWardenNotifications({ bookings = [], complaints = [], helpTickets = [], students = [], curfewStatuses = [] }) {
  const names = new Map(students.map((s) => [s.id, s.full_name]));
  const who = (id) => names.get(id) ?? "A student";
  const items = [];
  const now = Date.now();

  // Curfew: one alert per student per check-out that has gone overdue.
  curfewStatuses
    .filter((c) => c.status === "overdue")
    .forEach((c) => {
      items.push({ id: `wcurfew-${c.id}-${c.out_since ?? c.check_out_time}`, tab: "curfew", tone: "danger", at: c.out_since ?? new Date().toISOString(), title: "Curfew overdue 🌙", body: `${c.student_name} (Room ${c.room_number}) checked out at ${c.check_out_time} and hasn't returned.` });
    });

  complaints.forEach((c) => {
    const open = c.status !== "completed";
    const days = Math.floor((now - new Date(c.created_at).getTime()) / DAY);
    if (open && c.priority === "urgent")
      items.push({ id: `wurgent-${c.id}-${c.status}`, tab: "complaints", tone: "danger", at: c.created_at, title: "🚨 Urgent maintenance", body: `${who(c.student_id)}: ${c.category ?? "issue"}${c.room_number ? ` in Room ${c.room_number}` : ""} — ${c.status === "pending" ? "not assigned yet" : "in progress"}.` });
    if (open && days >= UNRESOLVED_AFTER_DAYS)
      items.push({ id: `wstale-${c.id}-${days >= 7 ? "7" : "3"}`, tab: "complaints", tone: "warn", at: new Date(new Date(c.created_at).getTime() + UNRESOLVED_AFTER_DAYS * DAY).toISOString(), title: "Complaint still unresolved", body: `${c.category ?? "Complaint"}${c.room_number ? ` (Room ${c.room_number})` : ""} has been open ${days} days.` });
    if (c.status === "completed" && c.assigned_technician)
      items.push({ id: `wresolved-${c.id}`, tab: "complaints", tone: "ok", at: c.created_at, title: "Complaint resolved ✅", body: `${c.category ?? "Complaint"}${c.room_number ? ` in Room ${c.room_number}` : ""} was marked completed.` });
  });

  // Booking requests waiting more than a day get a second nudge.
  bookings.forEach((b) => {
    if (b.status === "pending" && now - new Date(b.created_at).getTime() > DAY)
      items.push({ id: `wbooking-wait-${b.id}`, tab: "bookings", tone: "warn", at: new Date(new Date(b.created_at).getTime() + DAY).toISOString(), title: "Booking still waiting for approval", body: `${who(b.student_id)}'s request for ${roomText(b)} has been pending over a day.` });
  });

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
