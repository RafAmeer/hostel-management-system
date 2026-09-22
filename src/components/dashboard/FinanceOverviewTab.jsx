import BarChart from "./BarChart";
import ReportExportButton from "./ReportExportButton";
import { buildFinanceReport } from "../../lib/buildReports";

// Basic payment/financial summary per the proposal's Finance Module
// ("generate basic payment and financial summary reports"). Totals are
// computed here in plain JS from the payment records passed in — no AI
// involved on this side, just arithmetic on real rows.
function FinanceOverviewTab({ payments }) {
  const totalCollected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalOutstanding = payments
    .filter((p) => p.status !== "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const overdueCount = payments.filter((p) => p.status === "overdue").length;

  const chartData = [
    { label: "Paid", value: payments.filter((p) => p.status === "paid").length, tone: "ok" },
    { label: "Outstanding", value: payments.filter((p) => p.status === "outstanding").length, tone: "warn" },
    { label: "Overdue", value: overdueCount, tone: "danger" },
  ];

  return (
    <div className="tab">
      <div className="tab__title-row">
        <h2 className="tab__title">Finance Overview</h2>
        <ReportExportButton buildReport={() => buildFinanceReport(payments)} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Collected (this semester)</span>
          <span className="stat-card__value badge badge--ok">RM {totalCollected}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Outstanding</span>
          <span className="stat-card__value badge badge--warn">RM {totalOutstanding}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Overdue Payments</span>
          <span className={"stat-card__value badge badge--" + (overdueCount > 0 ? "danger" : "neutral")}>
            {overdueCount}
          </span>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-panel">
          <p className="chart__title">Payments by status</p>
          <BarChart data={chartData} />
        </div>
      </div>
    </div>
  );
}

export default FinanceOverviewTab;
