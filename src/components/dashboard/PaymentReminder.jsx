import { money, summarisePayments, daysUntilDue, formatDue } from "../../lib/payments";

// Student Home: a reminder card for hostel fees still owed. Hidden when
// everything is paid. Turns red once anything is past its due date, and
// says when Finance last sent a reminder.
function PaymentReminder({ payments = [] }) {
  const s = summarisePayments(payments);
  if (s.unpaidCount === 0) return null;

  const days = s.nextDue ? daysUntilDue(s.nextDue) : null;
  const overdue = s.overdueCount > 0;
  const lastReminder = payments
    .map((p) => p.reminder_sent_at)
    .filter(Boolean)
    .sort()
    .pop();

  let dueText = "";
  if (overdue) dueText = `${s.overdueCount} payment${s.overdueCount > 1 ? "s are" : " is"} overdue (${money(s.overdueAmount)}).`;
  else if (days === 0) dueText = "Due today.";
  else if (days === 1) dueText = "Due tomorrow.";
  else if (days !== null) dueText = `Next payment due in ${days} days (${formatDue(s.nextDue.due_date)}).`;

  return (
    <section
      className={"payment-reminder" + (overdue ? " payment-reminder--overdue" : days !== null && days <= 7 ? " payment-reminder--soon" : "")}
      role={overdue ? "alert" : "status"}
      aria-label="Hostel fee reminder"
    >
      <span className="payment-reminder__icon" aria-hidden="true">💳</span>
      <div className="payment-reminder__body">
        <p className="payment-reminder__eyebrow">{overdue ? "Payment overdue" : "Payment reminder"}</p>
        <p className="payment-reminder__amount">
          {money(s.outstanding)} <span>outstanding</span>
        </p>
        {dueText && <p className="payment-reminder__text">{dueText}</p>}
        <ul className="payment-reminder__list">
          {payments
            .filter((p) => p.status !== "paid")
            .slice(0, 3)
            .map((p) => (
              <li key={p.id}>
                {p.semester ?? "Hostel fee"}
                {p.room_number ? ` · Room ${p.room_number}` : ""} — {money(Math.max(0, Number(p.amount ?? 0) - Number(p.amount_paid ?? 0)))}
                {p.due_date ? ` · due ${formatDue(p.due_date)}` : ""}
              </li>
            ))}
        </ul>
        <p className="payment-reminder__hint">
          Pay at the Finance office or by bank transfer, then keep your receipt.
          {lastReminder ? ` Finance sent you a reminder on ${formatDue(lastReminder.slice(0, 10))}.` : ""}
        </p>
      </div>
    </section>
  );
}

export default PaymentReminder;
