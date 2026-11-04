import BarChart from "./BarChart";
import ReportExportButton from "./ReportExportButton";
import { buildFinanceReport } from "../../lib/buildReports";
import { money, outstandingByStudent, paymentState, summarisePayments } from "../../lib/payments";

// Payment/financial summary per the proposal's Finance Module. Totals use
// the remaining balance of each charge, so part-payments are counted
// correctly (collected = what's been received, outstanding = what's left).
function FinanceOverviewTab({ payments, onNavigate }) {
  const s = summarisePayments(payments);
  const owing = outstandingByStudent(payments).slice(0, 5);
  const count = (st) => payments.filter((p) => paymentState(p) === st).length;

  const chartData = [
    { label: "Paid", value: count("paid"), tone: "ok" },
    { label: "Partly paid", value: count("partial"), tone: "warn" },
    { label: "Outstanding", value: count("outstanding"), tone: "warn" },
    { label: "Overdue", value: count("overdue"), tone: "danger" },
  ];

  return (
    <div className="tab">
      <div className="tab__title-row">
        <h2 className="tab__title">Finance Overview</h2>
        <ReportExportButton buildReport={() => buildFinanceReport(payments)} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Collected</span>
          <span className="stat-card__value badge badge--ok">{money(s.collected)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Outstanding remaining</span>
          <span className="stat-card__value badge badge--warn">{money(s.outstanding)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Overdue</span>
          <span className={"stat-card__value badge badge--" + (s.overdueCount > 0 ? "danger" : "neutral")}>
            {money(s.overdueAmount)} · {s.overdueCount}
          </span>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-panel">
          <p className="chart__title">Payments by status</p>
          <BarChart data={chartData} />
        </div>
        <div className="chart-panel">
          <p className="chart__title">Highest balances</p>
          {owing.length === 0 ? (
            <p className="tab__empty">Nobody owes anything right now.</p>
          ) : (
            <ul className="finance-owing">
              {owing.map((o) => (
                <li key={o.student_id ?? o.student_name}>
                  <span>{o.student_name}</span>
                  <strong className={o.overdue ? "text-danger" : ""}>{money(o.balance)}</strong>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="link-btn" onClick={() => onNavigate?.("payments")}>
            See all and send reminders
          </button>
        </div>
      </div>
    </div>
  );
}

export default FinanceOverviewTab;
