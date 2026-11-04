import { balanceOf, outstandingByStudent, paymentState, PAYMENT_LABELS, summarisePayments } from "./payments";
import { buildMovementRecords, formatDuration, formatStamp } from "./curfew";
import { buildOccupancy } from "./occupancy";

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
  const s = summarisePayments(payments);
  const count = (st) => payments.filter((p) => paymentState(p) === st).length;
  const statusChart = {
    labels: ["Paid", "Partly paid", "Outstanding", "Overdue"],
    datasets: [{ data: [count("paid"), count("partial"), count("outstanding"), count("overdue")], tones: ["success", "info", "warn", "danger"] }],
  };
  const amountChart = {
    labels: ["Collected", "Outstanding"],
    datasets: [{ label: "Amount (RM)", tone: "accent", data: [Math.round(s.collected), Math.round(s.outstanding)] }],
  };
  const owing = outstandingByStudent(payments);

  return {
    title: "Finance Payments Summary Report",
    generatedAt: today(),
    sections: [
      {
        heading: "Summary",
        rows: [
          ["Metric", "Value"],
          ["Collected (RM)", s.collected.toFixed(2)],
          ["Outstanding remaining (RM)", s.outstanding.toFixed(2)],
          ["Overdue (RM)", s.overdueAmount.toFixed(2)],
          ["Unpaid records", s.unpaidCount],
          ["Overdue records", s.overdueCount],
          ["Students with a balance", owing.length],
        ],
      },
      ...(payments.length
        ? [
            { heading: "Payments by status", chart: { type: "doughnut", data: statusChart } },
            { heading: "Collected vs outstanding (RM)", chart: { type: "bar", data: amountChart } },
          ]
        : []),
      ...(owing.length
        ? [
            {
              heading: "Outstanding balance by student",
              rows: [
                ["Student", "Room", "Balance (RM)", "Overdue (RM)", "Last reminder"],
                ...owing.map((o) => [o.student_name, o.room_number ?? "—", o.balance.toFixed(2), o.overdue.toFixed(2), o.lastReminder ? o.lastReminder.slice(0, 10) : "—"]),
              ],
            },
          ]
        : []),
      {
        heading: "All payment records",
        rows: [
          ["Student", "Room", "Semester", "Charge (RM)", "Paid (RM)", "Balance (RM)", "Due date", "Status"],
          ...payments.map((p) => [
            p.student_name ?? "—",
            p.room_number ?? "—",
            p.semester ?? "—",
            Number(p.amount ?? 0).toFixed(2),
            Number(p.status === "paid" ? p.amount : p.amount_paid ?? 0).toFixed(2),
            balanceOf(p).toFixed(2),
            p.due_date ?? "—",
            PAYMENT_LABELS[paymentState(p)],
          ]),
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------
// Separate warden reports (user-testing feedback: downloadable reports for
// occupancy, curfew records, complaints, room bookings and hostel
// activity — not only the one summary).
// ---------------------------------------------------------------------


const d = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function buildOccupancyReport(residences, rooms, students, bookings) {
  const occ = buildOccupancy(residences, rooms, students, bookings);
  return {
    title: "Hostel Occupancy Report",
    generatedAt: today(),
    sections: [
      {
        heading: "Occupancy by hostel",
        rows: [
          ["Hostel", "Rooms", "Beds", "Occupied beds", "Vacant beds", "Full rooms", "Empty rooms", "Occupancy %"],
          ...occ.hostels.map((h) => [h.name, h.rooms.length, h.beds, h.occupied, h.vacant, h.fullRooms, h.emptyRooms, `${h.rate}%`]),
          ["All hostels", occ.totals.rooms, occ.totals.beds, occ.totals.occupied, occ.totals.vacant, occ.totals.fullRooms, occ.totals.emptyRooms, `${occ.totals.rate}%`],
        ],
        chart: occ.hostels.length
          ? {
              type: "bar",
              stacked: true,
              legend: true,
              horizontal: true,
              data: {
                labels: occ.hostels.map((h) => h.name),
                datasets: [
                  { label: "Occupied", tone: "accent", data: occ.hostels.map((h) => h.occupied) },
                  { label: "Vacant", tone: "success", data: occ.hostels.map((h) => h.vacant) },
                ],
              },
            }
          : undefined,
      },
      {
        heading: "Rooms and current residents",
        rows: [
          ["Hostel", "Floor", "Room", "Gender", "Capacity", "Occupied", "Vacant", "Residents"],
          ...occ.hostels.flatMap((h) =>
            h.rooms.map((r) => [h.name, r.floor ?? "—", r.room_number, r.gender ?? "—", r.capacity, r.occupied, r.vacant, r.residents.map((s) => s.full_name).join(", ") || "—"])
          ),
        ],
      },
      ...(occ.unplaced.length
        ? [
            {
              heading: "Students marked in hostel without a matching room",
              rows: [["Student", "Student ID", "Room on profile"], ...occ.unplaced.map((s) => [s.full_name ?? "—", s.student_id ?? "—", s.room_number ?? "—"])],
            },
          ]
        : []),
    ],
  };
}

export function buildCurfewReport(curfewLogs, students, curfewStatuses = []) {
  const records = buildMovementRecords(curfewLogs, students);
  const late = records.filter((r) => r.late);
  return {
    title: "Curfew Records Report",
    generatedAt: today(),
    sections: [
      {
        heading: "Summary",
        rows: [
          ["Metric", "Value"],
          ["Total scans", curfewLogs.length],
          ["Leave/return records", records.length],
          ["Late returns / overdue", late.length],
          ["Out right now", curfewStatuses.length],
          ["Overdue right now", curfewStatuses.filter((s) => s.status === "overdue").length],
        ],
      },
      ...(curfewStatuses.length
        ? [
            {
              heading: "Students out right now",
              rows: [
                ["Student", "Room", "Checked out", "Out for", "Status"],
                ...curfewStatuses.map((s) => [s.student_name, s.room_number, formatStamp(s.out_since), formatDuration(s.out_for_ms), s.status === "overdue" ? "Overdue" : "Out"]),
              ],
            },
          ]
        : []),
      {
        heading: "Student movement records",
        rows: [
          ["Student", "Student ID", "Room", "Left", "Returned", "Time out", "Scan point", "Status"],
          ...records.map((r) => [
            r.student_name,
            r.student_no || "—",
            r.room_number,
            formatStamp(r.out_at),
            r.still_out ? "Not back yet" : formatStamp(r.in_at),
            formatDuration(r.duration_ms),
            r.location ?? "—",
            r.still_out ? (r.late ? "Overdue" : "Out") : r.late ? "Late" : r.out_at ? "On time" : "Check-in only",
          ]),
        ],
      },
    ],
  };
}

export function buildComplaintsReport(complaints, technicians = []) {
  const tech = new Map(technicians.map((t) => [t.id, t.full_name]));
  const count = (st) => complaints.filter((c) => c.status === st).length;
  const byCat = {};
  complaints.forEach((c) => {
    byCat[c.category ?? "Other"] = (byCat[c.category ?? "Other"] ?? 0) + 1;
  });
  return {
    title: "Complaints & Maintenance Report",
    generatedAt: today(),
    sections: [
      {
        heading: "Summary",
        rows: [
          ["Metric", "Value"],
          ["Total complaints", complaints.length],
          ["Pending (unassigned)", count("pending")],
          ["In progress", count("in_progress")],
          ["Completed", count("completed")],
          ["Urgent and still open", complaints.filter((c) => c.priority === "urgent" && c.status !== "completed").length],
        ],
        chart: complaints.length
          ? {
              type: "doughnut",
              data: {
                labels: ["Pending", "In progress", "Completed"],
                datasets: [{ data: [count("pending"), count("in_progress"), count("completed")], tones: ["muted", "warn", "success"] }],
              },
            }
          : undefined,
      },
      { heading: "By category", rows: [["Category", "Count"], ...Object.entries(byCat)] },
      {
        heading: "All complaints",
        rows: [
          ["Reported", "Student", "Hostel", "Room", "Category", "Priority", "Status", "Technician", "Description"],
          ...complaints.map((c) => [
            d(c.created_at),
            c.student_name ?? "—",
            c.hostel ?? "—",
            c.room_number ?? "—",
            c.category ?? "—",
            c.priority === "urgent" ? "Urgent" : "Normal",
            c.status ?? "—",
            tech.get(c.assigned_technician) ?? (c.assigned_technician ? "Assigned" : "—"),
            c.description ?? "",
          ]),
        ],
      },
    ],
  };
}

export function buildBookingsReport(bookings) {
  const count = (st) => bookings.filter((b) => b.status === st).length;
  return {
    title: "Room Bookings Report",
    generatedAt: today(),
    sections: [
      {
        heading: "Summary",
        rows: [
          ["Status", "Count"],
          ["Pending", count("pending")],
          ["Approved", count("approved")],
          ["Rejected", count("rejected")],
          ["Cancelled", count("cancelled")],
          ["Total", bookings.length],
        ],
        chart: bookings.length
          ? {
              type: "doughnut",
              data: {
                labels: ["Pending", "Approved", "Rejected", "Cancelled"],
                datasets: [{ data: [count("pending"), count("approved"), count("rejected"), count("cancelled")], tones: ["warn", "success", "danger", "muted"] }],
              },
            }
          : undefined,
      },
      {
        heading: "All bookings",
        rows: [
          ["Requested", "Student", "Hostel", "Floor", "Room", "Semester", "Status"],
          ...bookings.map((b) => [d(b.created_at), b.student_name ?? "—", b.hostel ?? "—", b.floor ?? "—", b.room_number ?? "—", b.semester ?? "—", b.status ?? "—"]),
        ],
      },
    ],
  };
}

export function buildActivityReport(logs = []) {
  return {
    title: "Hostel Activity Log",
    generatedAt: today(),
    sections: [
      {
        heading: "Recorded actions",
        rows: [
          ["When", "Who", "Role", "Action", "Details"],
          ...logs.map((l) => [formatStamp(l.created_at), l.actor_name ?? "System", l.actor_role ?? "—", l.action, l.summary ?? ""]),
        ],
      },
    ],
  };
}
