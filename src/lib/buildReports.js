// Turns the already-computed analytics/payments data into the plain
// { title, generatedAt, sections } shape lib/reportExport.js knows how to
// write out as PDF/Word/Excel. No new numbers are computed here — same
// principle as analytics.js: the report shows exactly what's on screen.

function today() {
  return new Date().toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" });
}

export function buildWardenReport(analytics, periodLabel) {
  const t = analytics.totals;

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
    ],
  };
}

export function buildFinanceReport(payments) {
  const paid = payments.filter((p) => p.status === "paid");
  const outstanding = payments.filter((p) => p.status !== "paid");
  const sum = (list) => list.reduce((total, p) => total + Number(p.amount ?? 0), 0);

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
