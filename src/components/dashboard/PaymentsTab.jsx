import { useMemo, useState } from "react";
import {
  balanceOf,
  formatDue,
  money,
  outstandingByStudent,
  paymentState,
  PAYMENT_LABELS,
  PAYMENT_TONE,
  summarisePayments,
} from "../../lib/payments";

const VIEWS = [
  { key: "outstanding", label: "Outstanding by student" },
  { key: "records", label: "All records" },
  { key: "new", label: "New charge" },
];

// Finance Module: record payments (in full or in parts), see each
// student's remaining balance, and send a payment reminder that shows up
// on the student's Home page and as a notification.
function PaymentsTab({ payments, students = [], onRecordPayment, onSendReminder, onCreateCharge }) {
  const [view, setView] = useState("outstanding");
  const [paying, setPaying] = useState(null);
  const owing = useMemo(() => outstandingByStudent(payments), [payments]);
  const s = summarisePayments(payments);

  return (
    <div className="tab">
      <h2 className="tab__title">Payments</h2>

      <div className="stat-mini-row">
        <div className="stat-mini stat-mini--warn">
          <strong>{money(s.outstanding)}</strong>
          <span>Outstanding</span>
        </div>
        <div className={"stat-mini" + (s.overdueAmount ? " stat-mini--danger" : "")}>
          <strong>{money(s.overdueAmount)}</strong>
          <span>Overdue</span>
        </div>
        <div className="stat-mini">
          <strong>{owing.length}</strong>
          <span>Students owing</span>
        </div>
        <div className="stat-mini stat-mini--ok">
          <strong>{money(s.collected)}</strong>
          <span>Collected</span>
        </div>
      </div>

      <div className="filter-chips" role="tablist" aria-label="Payment views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={"filter-chip" + (view === v.key ? " filter-chip--active" : "")}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "outstanding" &&
        (owing.length === 0 ? (
          <p className="tab__empty">Nobody owes anything right now. 🎉</p>
        ) : (
          <div className="list">
            {owing.map((o) => (
              <div key={o.student_id ?? o.student_name} className={"list-row list-row--wrap" + (o.overdue ? " list-row--urgent" : "")}>
                <div>
                  <p className="list-row__title">
                    {o.student_name} &middot; {money(o.balance)} remaining
                  </p>
                  <p className="list-row__meta">
                    {o.room_number ? `Room ${o.room_number} · ` : ""}
                    {o.records.length} unpaid record{o.records.length > 1 ? "s" : ""}
                    {o.overdue ? ` · ${money(o.overdue)} overdue` : ""}
                  </p>
                  <p className="list-row__meta">
                    {o.lastReminder ? `Last reminder sent ${formatDue(o.lastReminder.slice(0, 10))}` : "No reminder sent yet"}
                  </p>
                </div>
                <div className="list-row__actions">
                  <span className={"badge badge--" + (o.overdue ? "danger" : "warn")}>{o.overdue ? "Overdue" : "Outstanding"}</span>
                  <button type="button" className="btn-outline btn-sm" onClick={() => onSendReminder?.(o)}>
                    Send reminder
                  </button>
                  <button type="button" className="primary-btn btn-sm" onClick={() => setPaying(o.records[0])}>
                    Record payment
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}

      {view === "records" &&
        (payments.length === 0 ? (
          <p className="tab__empty">No payment records yet.</p>
        ) : (
          <div className="list">
            {payments.map((p) => {
              const st = paymentState(p);
              return (
                <div key={p.id} className="list-row list-row--wrap">
                  <div>
                    <p className="list-row__title">
                      {p.student_name} &middot; {money(p.amount)}
                    </p>
                    <p className="list-row__meta">
                      {p.room_number ? `Room ${p.room_number} · ` : ""}
                      {p.semester ?? "—"} &middot; Due {formatDue(p.due_date)}
                    </p>
                    {st !== "paid" && (
                      <p className="list-row__meta">
                        Paid {money(p.amount_paid)} · <strong>{money(balanceOf(p))} remaining</strong>
                      </p>
                    )}
                  </div>
                  <div className="list-row__actions">
                    <span className={"badge badge--" + PAYMENT_TONE[st]}>{PAYMENT_LABELS[st]}</span>
                    {st !== "paid" && (
                      <button className="primary-btn btn-sm" onClick={() => setPaying(p)}>
                        Record payment
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {view === "new" && <NewChargeForm students={students} onCreate={onCreateCharge} onDone={() => setView("outstanding")} />}

      {paying && (
        <RecordPaymentDialog
          payment={paying}
          siblings={payments.filter((p) => p.student_id === paying.student_id && balanceOf(p) > 0)}
          onCancel={() => setPaying(null)}
          onSave={async (row, amount) => {
            const ok = await onRecordPayment?.(row, amount);
            if (ok) setPaying(null);
          }}
        />
      )}
    </div>
  );
}

function RecordPaymentDialog({ payment, siblings, onCancel, onSave }) {
  const [rowId, setRowId] = useState(payment.id);
  const row = siblings.find((p) => p.id === rowId) ?? payment;
  const [amount, setAmount] = useState(String(balanceOf(payment).toFixed(2)));
  const [busy, setBusy] = useState(false);
  const n = Number(amount);
  const valid = n > 0 && n <= balanceOf(row) + 0.001;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pay-title" onClick={onCancel}>
      <form
        className="glass-panel transfer-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setBusy(true);
          await onSave(row, n);
          setBusy(false);
        }}
      >
        <h3 id="pay-title" className="panel-heading">
          Record payment — {row.student_name}
        </h3>
        {siblings.length > 1 && (
          <label className="field">
            <span className="field__label">For</span>
            <select
              value={rowId}
              onChange={(e) => {
                const next = siblings.find((p) => String(p.id) === e.target.value);
                setRowId(next.id);
                setAmount(String(balanceOf(next).toFixed(2)));
              }}
            >
              {siblings.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.semester ?? "Fee"} · {money(balanceOf(p))} left · due {formatDue(p.due_date)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="list-row__meta">
          Charge {money(row.amount)} · already paid {money(row.amount_paid)} · <strong>{money(balanceOf(row))} remaining</strong>
        </p>
        <label className="field">
          <span className="field__label">Amount received (RM)</span>
          <input type="number" min="0.01" step="0.01" max={balanceOf(row)} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        {!valid && amount !== "" && <p className="message message--error">Enter an amount between RM 0.01 and {money(balanceOf(row))}.</p>}
        <p className="list-row__meta">
          {valid && n >= balanceOf(row) - 0.001
            ? "This settles the charge in full."
            : valid
            ? `${money(balanceOf(row) - n)} will still be outstanding.`
            : ""}
        </p>
        <div className="transfer-dialog__actions">
          <button type="button" className="btn-outline btn-outline--neutral" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={!valid || busy}>
            {busy ? "Saving…" : "Save payment"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewChargeForm({ students, onCreate, onDone }) {
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [semester, setSemester] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sorted = [...students].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  const student = students.find((s) => s.id === studentId);

  return (
    <form
      className="glass-panel announce-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        if (!student) return setError("Choose a student.");
        if (!(Number(amount) > 0)) return setError("Enter an amount above RM 0.");
        if (!dueDate) return setError("Choose a due date.");
        setBusy(true);
        const ok = await onCreate?.({
          student_id: student.id,
          student_name: student.full_name,
          room_number: student.room_number ?? null,
          amount: Number(amount),
          semester: semester || student.semester || null,
          due_date: dueDate,
        });
        setBusy(false);
        if (ok) onDone?.();
      }}
    >
      <h3 className="panel-heading">New hostel fee charge</h3>
      {error && <p className="message message--error">{error}</p>}
      <label className="field">
        <span className="field__label">Student</span>
        <select
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            setSemester(students.find((s) => s.id === e.target.value)?.semester ?? "");
          }}
        >
          <option value="">Choose a student…</option>
          {sorted.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name ?? "Unnamed"} {s.student_id ? `(${s.student_id})` : ""} {s.room_number ? `· ${s.room_number}` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="announce-form__row">
        <label className="field">
          <span className="field__label">Amount (RM)</span>
          <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Semester</span>
          <input type="text" value={semester} placeholder="e.g. S2/2026" onChange={(e) => setSemester(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      <button type="submit" className="primary-btn primary-btn--wide" disabled={busy}>
        {busy ? "Saving…" : "Add charge"}
      </button>
      <p className="list-row__meta">The student sees it on their Home page as a payment reminder straight away.</p>
    </form>
  );
}

export default PaymentsTab;
