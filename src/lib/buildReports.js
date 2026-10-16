// Turns the already-computed analytics/payments data into the plain
// { title, generatedAt, sections } shape lib/reportExport.js knows how to
// write out as PDF/Word/Excel. No new numbers are computed here — same
// principle as analytics.js: the report shows exactly what's on screen.

function today() {
  return new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
}

// `model` (optional) is the chart data WardenOverviewTab already built for
// its on-screen graphs, so the exported report shows exactly the same
// graphs. Charts with nothing to plot are left out.
export function buildWardenReport(analytics, periodLabel, model) {
  const t = analytics.totals;
  const has = (chart) => chart && chart.datasets.some((d) => d.data.some((n) => n > 0));
  const chart = (heading, key, opts = {}) =>
    model && has(model[key]) ? [{ heading, chart: { type: opts.type ?? "bar", data: model[key], ...opts.extra } }] : [];

  return {
    title: "Hostel Management Summary Report",
    generatedAt: today(),
    sections: [
      {
        heading: `Overview (${periodLabel})`,
        rows: [
          ["Metric", "Value"],
          ["Registered students", t.registeredStudents],
          ["Total rooms", t.totalRooms],
          ["Occupied capacity", `${t.totalOccupied} / ${t.totalCapacity}`],
          ["Fully occupied rooms", t.fullRooms],
          ["Bookings (period)", t.bookings],
          ["Complaints (period)", t.complaints],
          ["Students currently out", t.studentsCurrentlyOut],
          ["Overdue curfews", t.overdueCurfews],
        ],
      },
      {
        heading: "Room bookings by status",
        rows: [
          ["Status", "Count"],
          ...Object.entries(analytics.bookingsByStatus).map(([k, v]) => [k, v]),
        ],
      },
      {
        heading: "Complaints by category",
        rows: [
          ["Category", "Count"],
          ...Object.entries(analytics.complaintsByCategory).map(([k, v]) => [k, v]),
        ],
      },
      ...chart(`Activity over time (${periodLabel})`, "trend", { type: "line", extra: { legend: true } }),
      ...chart("Curfew right now", "curfewNow", { type: "doughnut" }),
      ...chart("Booking requests by status", "bookingStatus", { type: "doughnut" }),
      ...chart("Bookings per hostel", "bookingsByHostel", { extra: { horizontal: true, stacked: true, legend: true } }),
      ...chart("Bed occupancy", "occupancy", { type: "doughnut" }),
      ...chart("Complaints by category", "complaintsByCategory"),
      ...chart("Complaints by status", "complaintStatus", { type: "doughnut" }),
      ...chart("Complaints by hostel", "complaintsByHostel", { extra: { horizontal: true } }),
      ...chart("Curfew scans over time", "scans", { extra: { legend: true } }),
      ...chart("Students by gender", "genderChart", { type: "doughnut" }),
      ...chart("Students staying in a hostel", "residence", { type: "doughnut" }),
      ...chart("Students by programme", "programmeChart", { extra: { horizontal: true } }),
    ],
  };
}

export function buildFinanceReport(payments) {
  const paid = payments.filter((p) => p.status === "paid");
  const outstanding = payments.filter((p) => p.status !== "paid");
  const sum = (list) => list.reduce((total, p) => total + Number(p.amount ?? 0), 0);
  const count = (status) => payments.filter((p) => p.status === status).length;
  const statusChart = {
    labels: ["Paid", "Outstanding", "Overdue"],
    datasets: [{ data: [count("paid"), count("outstanding"), count("overdue")], tones: ["success", "warn", "danger"] }],
  };
  const amountChart = {
    labels: ["Collected", "Outstanding"],
    datasets: [{ label: "Amount (RM)", tone: "accent", data: [Math.round(sum(paid)), Math.round(sum(outstanding))] }],
  };

  return {
    title: "Finance Payments Summary Report",
    generatedAt: today(),
    sections: [
      {
        heading: "Summary",
        rows: [
          ["Metric", "Value"],
          ["Collected (RM)", sum(paid).toFixed(2)],
          ["Outstanding (RM)", sum(outstanding).toFixed(2)],
          ["Paid records", paid.length],
          ["Outstanding records", outstanding.length],
          ["Overdue records", payments.filter((p) => p.status === "overdue").length],
        ],
      },
      ...(payments.length
        ? [
            { heading: "Payments by status", chart: { type: "doughnut", data: statusChart } },
            { heading: "Collected vs outstanding (RM)", chart: { type: "bar", data: amountChart } },
          ]
        : []),
      {
        heading: "All payment records",
        rows: [
          ["Student", "Room", "Semester", "Amount (RM)", "Due date", "Status"],
          ...payments.map((p) => [
            p.student_name ?? "—",
            p.room_number ?? "—",
            p.semester ?? "—",
            Number(p.amount ?? 0).toFixed(2),
            p.due_date ?? "—",
            p.status ?? "—",
          ]),
        ],
      },
    ],
  };
}
