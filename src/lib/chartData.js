// Turns the raw Supabase rows the warden already has into the label/value
// arrays the charts need. All counting happens here (never in the AI), the
// same rule as lib/analytics.js.
import { residenceForBooking } from "./hostelOf";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const dayLabel = (d) => d.toLocaleDateString([], { day: "numeric", month: "short" });

// Buckets for a trailing window: one per day for 7/30-day periods, one per
// week (last 12) for "all time". Each bucket is { label, start, end }.
export function makeBuckets(periodDays) {
  const today = startOfDay(new Date());
  const buckets = [];
  if (periodDays) {
    for (let i = periodDays - 1; i >= 0; i--) {
      const start = new Date(today.getTime() - i * DAY_MS);
      buckets.push({ label: dayLabel(start), start, end: new Date(start.getTime() + DAY_MS) });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(today.getTime() - i * 7 * DAY_MS);
      buckets.push({ label: `Wk of ${dayLabel(start)}`, start, end: new Date(start.getTime() + 7 * DAY_MS) });
    }
  }
  return buckets;
}

export function countPerBucket(items, dateKey, buckets, predicate = () => true) {
  const counts = buckets.map(() => 0);
  for (const item of items) {
    if (!predicate(item)) continue;
    const t = new Date(item[dateKey]).getTime();
    if (Number.isNaN(t)) continue;
    const i = buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
    if (i >= 0) counts[i] += 1;
  }
  return counts;
}

export function inPeriod(items, dateKey, periodDays) {
  if (!periodDays) return items;
  const from = Date.now() - periodDays * DAY_MS;
  return items.filter((i) => new Date(i[dateKey]).getTime() >= from);
}

export function tally(items, keyFn) {
  const out = new Map();
  for (const item of items) {
    const k = keyFn(item);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

// Sorted [label, count] pairs, biggest first, optionally capped (the rest
// is folded into "Other").
export function topEntries(map, limit = 8) {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length <= limit) return entries;
  const head = entries.slice(0, limit - 1);
  const other = entries.slice(limit - 1).reduce((sum, [, n]) => sum + n, 0);
  return [...head, ["Other", other]];
}

export function hostelNameForBooking(booking, rooms, residences) {
  return residenceForBooking(booking, rooms, residences)?.name ?? booking.hostel ?? "Not assigned";
}

export function hostelNameForComplaint(complaint, residences) {
  const raw = complaint.hostel;
  if (!raw) return "Not stated";
  const key = String(raw).trim().toLowerCase();
  return residences.find((r) => r.id.toLowerCase() === key || r.name.toLowerCase() === key)?.name ?? raw;
}
