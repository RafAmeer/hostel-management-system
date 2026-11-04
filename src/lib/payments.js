// Shared money helpers for the Finance dashboard and the student payment
// reminder. A payment row can be paid in parts: `amount` is what's owed,
// `amount_paid` is what Finance has recorded so far, and the balance is the
// difference. "Overdue" is worked out from the due date, so a row doesn't
// have to be updated by hand the day it goes overdue.

const DAY = 24 * 60 * 60 * 1000;

export const money = (n) =>
  "RM " + Number(n ?? 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function balanceOf(p) {
  if (!p || p.status === "paid") return 0;
  return Math.max(0, Number(p.amount ?? 0) - Number(p.amount_paid ?? 0));
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole days until the due date (negative = that many days late).
export function daysUntilDue(p) {
  if (!p?.due_date) return null;
  const due = new Date(p.due_date + "T00:00:00");
  return Math.round((due - startOfToday()) / DAY);
}

// "paid" | "overdue" | "partial" | "outstanding"
export function paymentState(p) {
  if (!p) return "outstanding";
  if (p.status === "paid" || balanceOf(p) === 0) return "paid";
  const days = daysUntilDue(p);
  if (p.status === "overdue" || (days !== null && days < 0)) return "overdue";
  if (Number(p.amount_paid ?? 0) > 0) return "partial";
  return "outstanding";
}

export const PAYMENT_LABELS = {
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partly paid",
  outstanding: "Outstanding",
};

export const PAYMENT_TONE = { paid: "ok", overdue: "danger", partial: "warn", outstanding: "warn" };

// One summary for a list of payment rows (a single student's, or everyone's).
export function summarisePayments(payments = []) {
  const unpaid = payments.filter((p) => paymentState(p) !== "paid");
  const overdue = unpaid.filter((p) => paymentState(p) === "overdue");
  const nextDue = [...unpaid]
    .filter((p) => p.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0] ?? null;
  return {
    totalOwed: payments.reduce((s, p) => s + Number(p.amount ?? 0), 0),
    collected: payments.reduce(
      (s, p) => s + (p.status === "paid" ? Number(p.amount ?? 0) : Number(p.amount_paid ?? 0)),
      0
    ),
    outstanding: unpaid.reduce((s, p) => s + balanceOf(p), 0),
    overdueAmount: overdue.reduce((s, p) => s + balanceOf(p), 0),
    unpaidCount: unpaid.length,
    overdueCount: overdue.length,
    nextDue,
  };
}

// Students with something left to pay, biggest balance first.
export function outstandingByStudent(payments = []) {
  const map = new Map();
  for (const p of payments) {
    const bal = balanceOf(p);
    if (bal <= 0) continue;
    const key = p.student_id ?? p.student_name;
    const row = map.get(key) ?? {
      student_id: p.student_id,
      student_name: p.student_name ?? "Unknown student",
      room_number: p.room_number,
      balance: 0,
      overdue: 0,
      records: [],
      lastReminder: null,
    };
    row.balance += bal;
    if (paymentState(p) === "overdue") row.overdue += bal;
    row.records.push(p);
    if (p.reminder_sent_at && (!row.lastReminder || p.reminder_sent_at > row.lastReminder)) row.lastReminder = p.reminder_sent_at;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

export function formatDue(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}
