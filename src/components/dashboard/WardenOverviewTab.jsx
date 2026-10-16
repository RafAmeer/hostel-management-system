import { useMemo } from "react";
import ChartCanvas from "./ChartCanvas";
import ReportExportButton from "./ReportExportButton";
import { buildWardenReport } from "../../lib/buildReports";
import {
  countPerBucket,
  hostelNameForBooking,
  hostelNameForComplaint,
  inPeriod,
  makeBuckets,
  tally,
  topEntries,
} from "../../lib/chartData";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 30 days", value: "30" },
  { label: "All time (weekly)", value: "all" },
];

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function ChartCard({ title, hint, wide = false, empty = false, children }) {
  return (
    <section className={"chart-card glass-panel" + (wide ? " chart-card--wide" : "")}>
      <h3 className="chart__title">{title}</h3>
      {hint && <p className="list-row__meta chart-card__hint">{hint}</p>}
      {empty ? <p className="tab__empty chart-card__empty">No data for this period yet.</p> : children}
    </section>
  );
}

// Warden analytics: graphs of the same data the rest of the dashboard
// already holds (bookings, complaints, rooms, students, curfew scans,
// transport). Counting is done in lib/chartData.js, drawing in Chart.js.
function WardenOverviewTab({
  analytics,
  curfewStatuses,
  period,
  onPeriodChange,
  bookings,
  complaints,
  rooms,
  students,
  curfewLogs,
  residences,
}) {
  const periodDays = period === "all" ? null : Number(period);

  const model = useMemo(() => {
    const buckets = makeBuckets(periodDays);
    const labels = buckets.map((b) => b.label);

    const bookingsIn = inPeriod(bookings, "created_at", periodDays);
    const complaintsIn = inPeriod(complaints, "created_at", periodDays);

    // 1. Activity over time
    const trend = {
      labels,
      datasets: [
        { label: "Bookings", tone: "accent", data: countPerBucket(bookings, "created_at", buckets), fill: true },
        { label: "Complaints", tone: "warm", data: countPerBucket(complaints, "created_at", buckets) },
      ],
    };

    // 2. Booking status
    const status = (s) => bookingsIn.filter((b) => b.status === s).length;
    const bookingStatus = {
      labels: ["Pending", "Approved", "Rejected / cancelled"],
      datasets: [
        {
          data: [status("pending"), status("approved"), status("rejected") + status("cancelled")],
          tones: ["warn", "success", "danger"],
        },
      ],
    };

    // 3. Bookings per hostel, split by status
    const perHostel = new Map();
    for (const b of bookingsIn) {
      const name = hostelNameForBooking(b, rooms, residences);
      const row = perHostel.get(name) ?? { pending: 0, approved: 0, other: 0 };
      if (b.status === "pending") row.pending += 1;
      else if (b.status === "approved") row.approved += 1;
      else row.other += 1;
      perHostel.set(name, row);
    }
    const hostelNames = [...perHostel.keys()].sort(
      (a, b) =>
        perHostel.get(b).pending + perHostel.get(b).approved + perHostel.get(b).other -
        (perHostel.get(a).pending + perHostel.get(a).approved + perHostel.get(a).other)
    );
    const bookingsByHostel = {
      labels: hostelNames,
      datasets: [
        { label: "Approved", tone: "success", data: hostelNames.map((n) => perHostel.get(n).approved) },
        { label: "Pending", tone: "warn", data: hostelNames.map((n) => perHostel.get(n).pending) },
        { label: "Rejected / cancelled", tone: "danger", data: hostelNames.map((n) => perHostel.get(n).other) },
      ],
    };

    // 4. Room occupancy (real rooms only — placeholder rooms aren't in the table)
    const capacity = rooms.reduce((sum, r) => sum + (r.capacity ?? 0), 0);
    const occupied = rooms.reduce((sum, r) => sum + Math.min(r.occupied_count ?? 0, r.capacity ?? 0), 0);
    const occupancy = {
      labels: ["Occupied beds", "Free beds"],
      datasets: [{ data: [occupied, Math.max(0, capacity - occupied)], tones: ["accent", "muted"] }],
    };

    // 5. Complaints
    const byCategory = topEntries(tally(complaintsIn, (c) => c.category ?? "Other"), 8);
    const complaintsByCategory = {
      labels: byCategory.map(([k]) => k),
      datasets: [{ label: "Complaints", tone: "warm", data: byCategory.map(([, n]) => n) }],
    };
    const cStatus = (s) => complaintsIn.filter((c) => c.status === s).length;
    const complaintStatus = {
      labels: ["Pending", "In progress", "Completed"],
      datasets: [{ data: [cStatus("pending"), cStatus("in_progress"), cStatus("completed")], tones: ["warn", "info", "success"] }],
    };
    const byComplaintHostel = topEntries(tally(complaintsIn, (c) => hostelNameForComplaint(c, residences)), 6);
    const complaintsByHostel = {
      labels: byComplaintHostel.map(([k]) => k),
      datasets: [{ label: "Complaints", tone: "warm", data: byComplaintHostel.map(([, n]) => n) }],
    };

    // 6. Curfew scans over time
    const scans = {
      labels,
      datasets: [
        {
          label: "Check-outs",
          tone: "warn",
          data: countPerBucket(curfewLogs, "timestamp", buckets, (l) => l.scan_type === "check_out"),
        },
        {
          label: "Check-ins",
          tone: "success",
          data: countPerBucket(curfewLogs, "timestamp", buckets, (l) => l.scan_type === "check_in"),
        },
      ],
    };

    // 7. Students
    const gender = tally(students, (s) => (s.gender === "female" ? "Female" : s.gender === "male" ? "Male" : "Not set"));
    const genderChart = {
      labels: [...gender.keys()],
      datasets: [
        {
          data: [...gender.values()],
          tones: [...gender.keys()].map((k) => (k === "Female" ? "warm" : k === "Male" ? "accent" : "muted")),
        },
      ],
    };
    const inHostel = students.filter((s) => s.in_hostel === true).length;
    const notInHostel = students.filter((s) => s.in_hostel === false).length;
    const residence = {
      labels: ["Staying in hostel", "Not in hostel", "Not set"],
      datasets: [
        {
          data: [inHostel, notInHostel, students.length - inHostel - notInHostel],
          tones: ["success", "danger", "muted"],
        },
      ],
    };
    const programmes = topEntries(tally(students, (s) => s.programme?.trim() || "Not set"), 8);
    const programmeChart = {
      labels: programmes.map(([k]) => k),
      datasets: [{ label: "Students", tone: "info", data: programmes.map(([, n]) => n) }],
    };

    // Curfew right now (live status, not period based)
    const cNow = (st) => curfewStatuses.filter((c) => c.status === st).length;
    const curfewNow = {
      labels: ["Checked in", "Out", "Overdue"],
      datasets: [{ data: [cNow("checked_in"), cNow("out"), cNow("overdue")], tones: ["success", "warn", "danger"] }],
    };

    return {
      // `trend` was built above but missing from this object, so the
      // "Activity this period" chart received `undefined` data and crashed
      // the whole dashboard (blank screen) right after warden login.
      trend,
      curfewNow,
      bookingStatus,
      bookingsByHostel,
      occupancy,
      complaintsByCategory,
      complaintStatus,
      complaintsByHostel,
      scans,
      genderChart,
      residence,
      programmeChart,
      empty: {
        bookings: bookingsIn.length === 0,
        hostel: hostelNames.length === 0,
        occupancy: capacity === 0,
        complaints: complaintsIn.length === 0,
        scans: !curfewLogs.some((l) => buckets.some((b) => new Date(l.timestamp) >= b.start && new Date(l.timestamp) < b.end)),
        students: students.length === 0,
      },
      kpis: {
        bookings: bookingsIn.length,
        approvalRate: pct(status("approved"), bookingsIn.length),
        occupancyRate: pct(occupied, capacity),
        openComplaints: complaintsIn.filter((c) => c.status !== "completed").length,
      },
    };
  }, [
    bookings,
    complaints,
    rooms,
    students,
    curfewLogs,
    residences,
    curfewStatuses,
    periodDays,
  ]);

  const { kpis, empty } = model;

  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "All time";
  const studentsOut = analytics.totals.studentsCurrentlyOut;
  const overdue = analytics.totals.overdueCurfews;
  const trendLabel = (t) => {
    if (!t) return null;
    if (t.pctChange > 0) return { text: `+${t.pctChange}% vs previous period`, tone: "warn" };
    if (t.pctChange < 0) return { text: `${t.pctChange}% vs previous period`, tone: "ok" };
    return { text: "flat vs previous period", tone: "neutral" };
  };
  const receiptItems = [
    { label: "Bookings", value: analytics.totals.bookings, trend: trendLabel(analytics.trends?.bookings) },
    { label: "Complaints", value: analytics.totals.complaints, trend: trendLabel(analytics.trends?.complaints) },
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
      <div className="tab__title-row">
        <h2 className="tab__title">Overview</h2>
        <ReportExportButton buildReport={() => buildWardenReport(analytics, periodLabel, model)} />
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card__label">Pending bookings</span>
          <span className="stat-card__value badge badge--warn">{analytics.bookingsByStatus.pending ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Open complaints</span>
          <span className="stat-card__value">{kpis.openComplaints}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Students out</span>
          <span className={"stat-card__value badge badge--" + (overdue > 0 ? "danger" : "neutral")}>
            {studentsOut}{overdue > 0 ? ` (${overdue} overdue)` : ""}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Approval rate</span>
          <span className="stat-card__value">{kpis.approvalRate}%</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__label">Bed occupancy</span>
          <span className="stat-card__value">{empty.occupancy ? "—" : `${kpis.occupancyRate}%`}</span>
        </div>
      </div>

      <div className="glass-panel ai-period-panel period-split">
        <div className="period-split__left">
          <p className="chart__title">Stats period</p>
          <select
            className="period-select"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            aria-label="Period"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="receipt">
            <p className="receipt__heading">
              {analytics.dateRange.days ? `${analytics.dateRange.start} to ${analytics.dateRange.end}` : "All time"}
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
        <div className="period-split__right">
          <p className="chart__title">Activity this period</p>
          <ChartCanvas type="line" data={model.trend} height={230} legend ariaLabel="Line chart of bookings and complaints over the selected period" />
        </div>
      </div>

      <div className="chart-card-grid">
        <ChartCard title="Curfew right now" hint="Live status, not limited to the period.">
          <ChartCanvas type="doughnut" data={model.curfewNow} ariaLabel="Doughnut chart of students checked in, out and overdue" />
        </ChartCard>

        <ChartCard title="Booking requests by status" empty={empty.bookings}>
          <ChartCanvas type="doughnut" data={model.bookingStatus} ariaLabel="Doughnut chart of booking requests by status" />
        </ChartCard>

        <ChartCard title="Bookings per hostel" empty={empty.hostel}>
          <ChartCanvas type="bar" data={model.bookingsByHostel} horizontal stacked legend ariaLabel="Stacked bar chart of bookings per hostel" />
        </ChartCard>

        <ChartCard
          title="Bed occupancy"
          hint="Counts rooms added under Hostels & Rooms."
          empty={empty.occupancy}
        >
          <ChartCanvas type="doughnut" data={model.occupancy} ariaLabel="Doughnut chart of occupied and free beds" />
        </ChartCard>

        <ChartCard title="Complaints by category" empty={empty.complaints}>
          <ChartCanvas type="bar" data={model.complaintsByCategory} ariaLabel="Bar chart of complaints by category" />
        </ChartCard>

        <ChartCard title="Complaints by status" empty={empty.complaints}>
          <ChartCanvas type="doughnut" data={model.complaintStatus} ariaLabel="Doughnut chart of complaints by status" />
        </ChartCard>

        <ChartCard title="Complaints by hostel" empty={empty.complaints}>
          <ChartCanvas type="bar" data={model.complaintsByHostel} horizontal ariaLabel="Bar chart of complaints by hostel" />
        </ChartCard>

        <ChartCard title="Curfew scans over time" wide empty={empty.scans}>
          <ChartCanvas type="bar" data={model.scans} legend ariaLabel="Bar chart of curfew check-ins and check-outs over time" />
        </ChartCard>

        <ChartCard title="Students by gender" empty={empty.students}>
          <ChartCanvas type="doughnut" data={model.genderChart} ariaLabel="Doughnut chart of students by gender" />
        </ChartCard>

        <ChartCard title="Students staying in a hostel" empty={empty.students}>
          <ChartCanvas type="doughnut" data={model.residence} ariaLabel="Doughnut chart of students in and out of hostels" />
        </ChartCard>

        <ChartCard title="Students by programme" empty={empty.students}>
          <ChartCanvas type="bar" data={model.programmeChart} horizontal ariaLabel="Bar chart of students by programme" />
        </ChartCard>

      </div>
    </div>
  );
}

export default WardenOverviewTab;
