// AI Predictions for the warden.
//
// Every forecast here is worked out with simple, explainable statistics in
// JavaScript (linear trend, averages, repeat counts) from the real rows the
// dashboard already loads. The AI model is only asked afterwards to explain
// these numbers and suggest actions, so the figures themselves can always be
// traced back to the data (and explained during a demo/viva).

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const HISTORY_WEEKS = 8;

// Curfew time used to decide whether a return was "late". Change this if
// the hostel's curfew is different (24-hour clock, 23 = 11:00 PM).
export const CURFEW_HOUR = 23;
// Returns before this hour (e.g. 2 AM) still count as after curfew.
const EARLY_MORNING_END = 6;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const time = (iso) => {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

// Least-squares straight line through (0, y0), (1, y1), ...
export function linearTrend(values) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0, predict: () => 0, spread: 0 };
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  const predict = (x) => intercept + slope * x;
  // Typical distance of the real points from the line — used as the +/- range.
  const spread = Math.sqrt(values.reduce((s, y, x) => s + (y - predict(x)) ** 2, 0) / n);
  return { slope, intercept, predict, spread };
}

function weeklyCounts(rows, dateKey, now) {
  const counts = new Array(HISTORY_WEEKS).fill(0);
  const start = now - HISTORY_WEEKS * WEEK;
  rows.forEach((r) => {
    const t = time(r[dateKey]);
    if (t === null || t < start || t > now) return;
    const idx = Math.min(HISTORY_WEEKS - 1, Math.floor((t - start) / WEEK));
    counts[idx] += 1;
  });
  return counts;
}

function weekLabels(now) {
  const start = now - HISTORY_WEEKS * WEEK;
  return Array.from({ length: HISTORY_WEEKS }, (_, i) =>
    new Date(start + i * WEEK).toLocaleDateString("en-MY", { day: "numeric", month: "short" })
  );
}

function confidenceFor(total) {
  if (total < 8) return { level: "low", label: "Low", note: "Not much history yet, so treat this as a rough guess." };
  if (total < 25) return { level: "medium", label: "Medium", note: "Based on a moderate amount of history." };
  return { level: "high", label: "High", note: "Based on a good amount of recent history." };
}

function trendWord(slope) {
  if (slope > 0.25) return "rising";
  if (slope < -0.25) return "falling";
  return "steady";
}

const pretty = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, " ") : "Other");

// ---- 1. Complaints next week -------------------------------------------
function forecastComplaints(complaints, now) {
  const weekly = weeklyCounts(complaints, "created_at", now);
  const total = weekly.reduce((a, b) => a + b, 0);
  const trend = linearTrend(weekly);
  const next = Math.max(0, Math.round(trend.predict(HISTORY_WEEKS)));
  const range = Math.max(1, Math.round(trend.spread));

  // Split the forecast across categories by their recent share.
  const start = now - HISTORY_WEEKS * WEEK;
  const recent = complaints.filter((c) => (time(c.created_at) ?? 0) >= start);
  const byCat = {};
  recent.forEach((c) => {
    const k = pretty(c.category);
    byCat[k] = (byCat[k] ?? 0) + 1;
  });
  const categories = Object.entries(byCat)
    .map(([category, count]) => ({
      category,
      share: Math.round((count / recent.length) * 100),
      expected: Math.round((count / recent.length) * next * 10) / 10,
    }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);

  // Which weekday complaints usually come in on.
  const byDay = new Array(7).fill(0);
  recent.forEach((c) => {
    byDay[new Date(c.created_at).getDay()] += 1;
  });
  const busiest = byDay.indexOf(Math.max(...byDay));

  return {
    weekly,
    labels: weekLabels(now),
    nextWeek: next,
    low: Math.max(0, next - range),
    high: next + range,
    weeklyAverage: Math.round((total / HISTORY_WEEKS) * 10) / 10,
    trend: trendWord(trend.slope),
    slopePerWeek: Math.round(trend.slope * 100) / 100,
    categories,
    busiestDay: recent.length ? WEEKDAYS[busiest] : null,
    confidence: confidenceFor(total),
    basedOn: total,
  };
}

// ---- 2. Rooms likely to need maintenance again -------------------------
function maintenanceHotspots(complaints, now) {
  const since = now - 90 * DAY;
  const groups = new Map();
  complaints.forEach((c) => {
    const t = time(c.created_at);
    if (t === null || t < since || !c.room_number) return;
    const key = `${c.hostel ?? ""}|${c.room_number}`;
    if (!groups.has(key)) groups.set(key, { hostel: c.hostel ?? null, room: c.room_number, items: [] });
    groups.get(key).items.push({ ...c, t });
  });

  return [...groups.values()]
    .map((g) => {
      const cats = {};
      g.items.forEach((i) => {
        const k = pretty(i.category);
        cats[k] = (cats[k] ?? 0) + 1;
      });
      const [topCat, topCount] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
      const last = Math.max(...g.items.map((i) => i.t));
      const open = g.items.filter((i) => i.status !== "completed").length;
      // Recent complaints count for more than old ones.
      const score = g.items.reduce((s, i) => s + (1 - (now - i.t) / (90 * DAY)), 0) + (topCount >= 2 ? 1 : 0) + open * 0.5;
      return {
        hostel: g.hostel,
        room: g.room,
        complaints: g.items.length,
        repeatCategory: topCount >= 2 ? topCat : null,
        topCategory: topCat,
        open,
        lastReported: new Date(last).toISOString(),
        risk: score >= 4.5 ? "high" : score >= 2.5 ? "medium" : "low",
        score: Math.round(score * 10) / 10,
      };
    })
    .filter((r) => r.complaints >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

// ---- 3. Occupancy and booking demand ------------------------------------
function forecastOccupancy(rooms, bookings, now) {
  const capacity = rooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
  const occupied = rooms.reduce((s, r) => s + (Number(r.occupied_count) || 0), 0);
  const pending = bookings.filter((b) => b.status === "pending").length;

  const weekly = weeklyCounts(bookings, "created_at", now);
  const trend = linearTrend(weekly);
  const next4 = [1, 2, 3, 4].reduce((s, k) => s + Math.max(0, trend.predict(HISTORY_WEEKS - 1 + k)), 0);
  const expectedRequests = Math.round(next4);

  const pct = (n) => (capacity ? Math.min(100, Math.round((n / capacity) * 100)) : null);
  return {
    capacity,
    occupied,
    pending,
    currentRate: pct(occupied),
    projectedRate: pct(occupied + pending),
    expectedRequestsNext30Days: expectedRequests,
    demandTrend: trendWord(trend.slope),
    weekly,
    willBeFull: capacity ? occupied + pending + expectedRequests >= capacity : false,
    bedsLeftAfterPending: capacity ? Math.max(0, capacity - occupied - pending) : null,
    confidence: confidenceFor(weekly.reduce((a, b) => a + b, 0)),
  };
}

// ---- 4. Curfew patterns --------------------------------------------------
const isLate = (d) => {
  const h = d.getHours();
  return h >= CURFEW_HOUR || h < EARLY_MORNING_END;
};

function curfewRisk(curfewLogs, students, now) {
  const since = now - 30 * DAY;
  const names = new Map(students.map((s) => [s.id, s]));
  const byStudent = new Map();
  const outByHour = new Array(24).fill(0);

  [...curfewLogs]
    .filter((l) => (time(l.timestamp) ?? 0) >= since)
    .sort((a, b) => time(a.timestamp) - time(b.timestamp))
    .forEach((l) => {
      const d = new Date(l.timestamp);
      if (!byStudent.has(l.student_id)) byStudent.set(l.student_id, { late: 0, outs: 0, lastOut: null, nights: new Set() });
      const s = byStudent.get(l.student_id);
      if (l.scan_type === "check_out") {
        s.outs += 1;
        s.lastOut = d;
        outByHour[d.getHours()] += 1;
      } else if (l.scan_type === "check_in" && isLate(d)) {
        s.late += 1;
        s.nights.add(d.getDay());
      }
    });

  const atRisk = [...byStudent.entries()]
    .map(([id, s]) => {
      const student = names.get(id);
      // Still out and it's already past curfew counts too.
      const stillOutLate = s.lastOut && isLate(new Date(now)) && s.outs > 0;
      const late = s.late;
      return {
        id,
        name: student?.full_name ?? "Unknown student",
        room: student?.room_number ?? null,
        lateReturns: late,
        checkOuts: s.outs,
        risk: late >= 4 ? "high" : late >= 2 || stillOutLate ? "medium" : "low",
        usualNights: [...s.nights].map((d) => WEEKDAYS[d]).slice(0, 2),
      };
    })
    .filter((s) => s.lateReturns > 0)
    .sort((a, b) => b.lateReturns - a.lateReturns)
    .slice(0, 6);

  const peakHour = outByHour.some((n) => n > 0) ? outByHour.indexOf(Math.max(...outByHour)) : null;
  const totalLate = atRisk.reduce((s, r) => s + r.lateReturns, 0);
  return {
    curfewHour: CURFEW_HOUR,
    outByHour,
    peakCheckoutHour: peakHour,
    atRisk,
    lateReturnsLast30Days: totalLate,
    expectedLateReturnsNextWeek: Math.round((totalLate / 30) * 7),
  };
}

export function buildPredictions({ bookings = [], complaints = [], rooms = [], students = [], curfewLogs = [] }) {
  const now = Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    complaints: forecastComplaints(complaints, now),
    hotspots: maintenanceHotspots(complaints, now),
    occupancy: forecastOccupancy(rooms, bookings, now),
    curfew: curfewRisk(curfewLogs, students, now),
  };
}

export const hourLabel = (h) =>
  h === null || h === undefined
    ? "—"
    : new Date(2000, 0, 1, h).toLocaleTimeString("en-MY", { hour: "numeric" }).replace(/\s/g, "").toLowerCase();

// Small, name-free version sent to the AI (no student names leave the app).
export function predictionsForAi(p) {
  return {
    complaintsNextWeek: {
      expected: p.complaints.nextWeek,
      likelyRange: [p.complaints.low, p.complaints.high],
      weeklyAverageLast8Weeks: p.complaints.weeklyAverage,
      trend: p.complaints.trend,
      likelyCategories: p.complaints.categories,
      busiestDay: p.complaints.busiestDay,
      confidence: p.complaints.confidence.label,
    },
    roomsLikelyToNeedMaintenance: p.hotspots.map((h) => ({
      hostel: h.hostel,
      room: h.room,
      complaintsLast90Days: h.complaints,
      repeatingProblem: h.repeatCategory,
      stillOpen: h.open,
      risk: h.risk,
    })),
    occupancy: {
      bedCapacity: p.occupancy.capacity,
      bedsOccupied: p.occupancy.occupied,
      pendingRequests: p.occupancy.pending,
      currentOccupancyPct: p.occupancy.currentRate,
      projectedOccupancyPctIfPendingApproved: p.occupancy.projectedRate,
      expectedNewRequestsNext30Days: p.occupancy.expectedRequestsNext30Days,
      demandTrend: p.occupancy.demandTrend,
      likelyToRunOutOfBeds: p.occupancy.willBeFull,
    },
    curfew: {
      curfewTime: hourLabel(p.curfew.curfewHour),
      lateReturnsLast30Days: p.curfew.lateReturnsLast30Days,
      expectedLateReturnsNextWeek: p.curfew.expectedLateReturnsNextWeek,
      studentsWithRepeatedLateReturns: p.curfew.atRisk.filter((s) => s.risk === "high").length,
      mostCommonCheckOutTime: hourLabel(p.curfew.peakCheckoutHour),
    },
  };
}
