import { useMemo, useState } from "react";
import BarChart from "./BarChart";
import HostelChatbot from "./HostelChatbot";
import { buildHostelAnalytics } from "../../lib/analytics";

const COMPLAINT_CATEGORIES = ["Plumbing", "Electrical", "Furniture", "Cleanliness", "Other"];

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "All time", value: "all" },
];

function trendLabel(trend) {
  if (!trend) return null;
  if (trend.pctChange > 0) return { text: `+${trend.pctChange}% vs previous period`, tone: "warn" };
  if (trend.pctChange < 0) return { text: `${trend.pctChange}% vs previous period`, tone: "ok" };
  return { text: "flat vs previous period", tone: "neutral" };
}

function WardenOverviewTab({ bookings, complaints, curfewStatuses, rooms = [], students = [] }) {
  const [period, setPeriod] = useState("7");

  const periodDays = period === "all" ? null : Number(period);

  // All counts, category breakdowns, and period-over-period trends are
  // computed here in JS — not by the AI — so the figures are guaranteed
  // correct regardless of what the model does with them. This same object
  // is handed to the AI chat assistant below as its only source of truth.
  const analytics = useMemo(
    () => buildHostelAnalytics({ bookings, complaints, curfewStatuses, rooms, students, periodDays }),
    [bookings, complaints, curfewStatuses, rooms, students, periodDays]
  );

  const studentsOut = analytics.totals.studentsCurrentlyOut;
  const overdue = analytics.totals.overdueCurfews;

  const bookingChartData = [
    { label: "Pending", value: analytics.bookingsByStatus.pending ?? 0, tone: "warn" },
    { label: "Approved", value: analytics.bookingsByStatus.approved ?? 0, tone: "ok" },
    { label: "Rejected", value: analytics.bookingsByStatus.rejected ?? 0, tone: "danger" },
  ];

  const complaintChartData = COMPLAINT_CATEGORIES.map((cat) => ({
    label: cat,
    value: analytics.complaintsByCategory[cat] ?? 0,
    tone: "neutral",
  })).filter((d) => d.value > 0);

  const curfewChartData = [
    { label: "Checked in", value: curfewStatuses.filter((c) => c.status === "checked_in").length, tone: "ok" },
    { label: "Out", value: curfewStatuses.filter((c) => c.status === "out").length, tone: "warn" },
    { label: "Overdue", value: curfewStatuses.filter((c) => c.status === "overdue").length, tone: "danger" },
  ];

  const bookingTrend = trendLabel(analytics.trends?.bookings);
  const complaintTrend = trendLabel(analytics.trends?.complaints);

  const receiptItems = [
    { label: "Bookings", value: analytics.totals.bookings, trend: bookingTrend },
    { label: "Complaints", value: analytics.totals.complaints, trend: complaintTrend },
    {
      label: "Top Category",
      value: analytics.topComplaintCategory
        ? `${analytics.topComplaintCategory.category} (${analytics.topComplaintCategory.count})`
        : "—",
    },
    { label: "Students Currently Out", value: studentsOut },
    { label: "Overdue Curfews", value: overdue },
  ];

  return (
    <div className="tab">
      <h2 className="tab__title">Warden Overview</h2>

      <div className="glass-panel ai-period-panel">
        <p className="chart__title">Stats period</p>
        <select
          className="period-select"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="receipt">
          <p className="receipt__heading">
            {analytics.dateRange.days
              ? `${analytics.dateRange.start} to ${analytics.dateRange.end}`
              : "All time"}
          </p>
          <div className="receipt__divider" />
          {receiptItems.map((item) => (
            <div className="receipt__row" key={item.label}>
              <span>{item.label}</span>
              <span>
                {item.value}
                {item.trend && (
                  <span className={`badge badge--${item.trend.tone} receipt__trend`}> {item.trend.text}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI-assisted analytics per the proposal — reworked from a single
          "Generate Summary" button into a chat assistant the warden can
          ask specific questions of, per supervisor feedback. */}
      <HostelChatbot stats={analytics} />

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Pending Bookings</span>
          <span className="stat-card__value badge badge--warn">{analytics.bookingsByStatus.pending ?? 0}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Open Complaints (period)</span>
          <span className="stat-card__value">{analytics.totals.complaints - (analytics.complaintsByStatus.completed ?? 0)}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Students Currently Out</span>
          <span className={"stat-card__value badge badge--" + (overdue > 0 ? "danger" : "neutral")}>
            {studentsOut}{overdue > 0 ? ` (${overdue} overdue)` : ""}
          </span>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-panel">
          <p className="chart__title">Room bookings by status</p>
          <BarChart data={bookingChartData} />
        </div>

        <div className="chart-panel">
          <p className="chart__title">Complaints by category</p>
          <BarChart data={complaintChartData.length ? complaintChartData : [{ label: "None yet", value: 0, tone: "neutral" }]} />
        </div>

        <div className="chart-panel">
          <p className="chart__title">Curfew status</p>
          <BarChart data={curfewChartData} />
        </div>
      </div>
    </div>
  );
}

export default WardenOverviewTab;
