import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDateTime } from "../../lib/formatters";

const STATUS_LABELS = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };

function tone(status) {
  if (status === "approved") return "ok";
  if (status === "rejected" || status === "cancelled") return "danger";
  return "warn";
}

const EMPTY_FORM = {
  id: null,
  hostel_id: "",
  name: "",
  pickup_point: "",
  destination: "Main Campus",
  times: "",
  days: "Mon–Fri",
  seats: "40",
  fee: "0",
  notes: "",
  active: true,
};

// Warden: manage shuttle routes for the off-campus hostels and decide
// students' seat requests.
function WardenTransportTab({ routes, requests, loads, students, residences, loadError, onChanged, notify }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const offCampus = residences.filter((r) => r.id !== "main-campus");
  const routeById = new Map(routes.map((r) => [r.id, r]));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const hostelName = (id) => residences.find((r) => r.id === id)?.name ?? id;

  const approvedFor = (routeId, semester) =>
    loads.find((l) => l.route_id === routeId && l.semester === semester)?.approved ?? 0;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const edit = (route) =>
    setForm({
      id: route.id,
      hostel_id: route.hostel_id,
      name: route.name,
      pickup_point: route.pickup_point ?? "",
      destination: route.destination ?? "Main Campus",
      times: (route.departure_times ?? []).join(", "),
      days: route.days ?? "Mon–Fri",
      seats: String(route.seats ?? 0),
      fee: String(route.fee ?? 0),
      notes: route.notes ?? "",
      active: route.active !== false,
    });

  const saveRoute = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.hostel_id) return setError("Choose the hostel this route serves.");
    if (!form.name.trim()) return setError("Give the route a name.");
    const seats = Number(form.seats);
    if (!Number.isFinite(seats) || seats < 0) return setError("Seats must be 0 or more.");

    const row = {
      hostel_id: form.hostel_id,
      name: form.name.trim(),
      pickup_point: form.pickup_point.trim() || null,
      destination: form.destination.trim() || "Main Campus",
      departure_times: form.times
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      days: form.days.trim() || "Mon–Fri",
      seats,
      fee: Number(form.fee) || 0,
      notes: form.notes.trim() || null,
      active: form.active,
    };

    setSaving(true);
    const { error: saveError } = form.id
      ? await supabase.from("transport_routes").update(row).eq("id", form.id)
      : await supabase.from("transport_routes").insert(row);
    setSaving(false);

    if (saveError) {
      setError(
        saveError.code === "23505"
          ? "That hostel already has a route with this name."
          : `Couldn't save the route: ${saveError.message}`
      );
      return;
    }
    notify?.(form.id ? "Route updated." : "Route added.", "success");
    setForm(EMPTY_FORM);
    onChanged?.();
  };

  const toggleActive = async (route) => {
    const { error: e } = await supabase
      .from("transport_routes")
      .update({ active: route.active === false })
      .eq("id", route.id);
    if (e) return notify?.(`Couldn't update the route: ${e.message}`, "error");
    onChanged?.();
  };

  const removeRoute = async (route) => {
    if (!window.confirm(`Delete "${route.name}"? Its seat requests are deleted too.`)) return;
    const { error: e } = await supabase.from("transport_routes").delete().eq("id", route.id);
    if (e) return notify?.(`Couldn't delete the route: ${e.message}`, "error");
    notify?.("Route deleted.", "success");
    if (form.id === route.id) setForm(EMPTY_FORM);
    onChanged?.();
  };

  const decide = async (req, status) => {
    const route = routeById.get(req.route_id);
    if (status === "approved" && route && approvedFor(route.id, req.semester) >= route.seats) {
      return notify?.(`${route.name} is already full for ${req.semester}. Raise its seats or reject the request.`, "error");
    }
    const { data, error: e } = await supabase
      .from("transport_requests")
      .update({ status })
      .eq("id", req.id)
      .select()
      .maybeSingle();
    if (e || !data) {
      return notify?.(e ? `Couldn't update the request: ${e.message}` : "The database didn't accept that change.", "error");
    }
    notify?.(status === "approved" ? "Seat approved." : "Request rejected.", "success");
    onChanged?.();
  };

  if (loadError) {
    return (
      <div className="tab">
        <h2 className="tab__title">Transport</h2>
        <p className="message message--info" role="status">
          Run supabase/migrations/2026-10-08_transport_booking_rules_device.sql in the Supabase SQL editor to
          turn on transport. ({loadError})
        </p>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  const renderRequest = (r) => {
    const route = routeById.get(r.route_id);
    const student = studentById.get(r.student_id);
    return (
      <div className="list-row" key={r.id}>
        <div>
          <p className="list-row__title">{student?.full_name ?? "Student"}</p>
          <p className="list-row__meta">
            {route?.name ?? "Route"} · {r.semester}
            {route ? ` · ${approvedFor(route.id, r.semester)}/${route.seats} seats taken` : ""} ·{" "}
            {formatDateTime(r.created_at)}
          </p>
        </div>
        <div className="list-row__actions">
          <span className={"badge badge--" + tone(r.status)}>{STATUS_LABELS[r.status] ?? r.status}</span>
          {r.status === "pending" && (
            <>
              <button type="button" className="primary-btn btn-sm" onClick={() => decide(r, "approved")}>
                Approve
              </button>
              <button type="button" className="btn-outline" onClick={() => decide(r, "rejected")}>
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Transport</h2>
      <p className="tab__subtitle-text">
        Shuttle routes for students living outside the main campus hostel, and their seat requests.
      </p>

      <h3 className="panel-heading panel-heading--sub">Seat requests{pending.length ? ` (${pending.length} pending)` : ""}</h3>
      {requests.length === 0 ? (
        <p className="tab__empty">No seat requests yet.</p>
      ) : (
        <>
          {pending.length === 0 ? (
            <p className="tab__empty">Nothing pending right now.</p>
          ) : (
            <div className="list">
              {pending.map(renderRequest)}
            </div>
          )}
          {decided.length > 0 && (
            <>
              <h3 className="panel-heading panel-heading--sub">Already decided</h3>
              <div className="list">
                {decided.map(renderRequest)}
              </div>
            </>
          )}
        </>
      )}

      <h3 className="panel-heading panel-heading--sub">Routes</h3>
      {routes.length === 0 ? (
        <p className="tab__empty">No routes yet. Add one below.</p>
      ) : (
        <div className="list">
          {routes.map((route) => (
            <div key={route.id} className="list-row">
              <div>
                <p className="list-row__title">
                  {route.name} · {hostelName(route.hostel_id)}
                </p>
                <p className="list-row__meta">
                  {(route.departure_times ?? []).join(", ") || "No times set"} · {route.days} · {route.seats} seats
                  {Number(route.fee) > 0 ? ` · RM ${route.fee}` : " · free"}
                </p>
              </div>
              <div className="list-row__actions">
                <span className={"badge badge--" + (route.active === false ? "neutral" : "ok")}>
                  {route.active === false ? "Hidden" : "Active"}
                </span>
                <button type="button" className="btn-outline btn-outline--neutral" onClick={() => edit(route)}>
                  Edit
                </button>
                <button type="button" className="btn-outline btn-outline--neutral" onClick={() => toggleActive(route)}>
                  {route.active === false ? "Show" : "Hide"}
                </button>
                <button type="button" className="btn-outline" onClick={() => removeRoute(route)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="glass-panel announce-form" onSubmit={saveRoute} style={{ marginTop: "1.25rem" }}>
        <h3 className="panel-heading">{form.id ? "Edit route" : "Add a route"}</h3>
        {error && (
          <p className="message message--error" role="alert">
            {error}
          </p>
        )}

        <div className="announce-form__row">
          <label className="field">
            <span className="field__label">Hostel</span>
            <select value={form.hostel_id} onChange={set("hostel_id")} required>
              <option value="">Select hostel</option>
              {offCampus.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Route name</span>
            <input type="text" value={form.name} onChange={set("name")} placeholder="KTS Village shuttle" required />
          </label>
        </div>

        <div className="announce-form__row">
          <label className="field">
            <span className="field__label">Pick-up point</span>
            <input type="text" value={form.pickup_point} onChange={set("pickup_point")} placeholder="Main gate" />
          </label>
          <label className="field">
            <span className="field__label">Destination</span>
            <input type="text" value={form.destination} onChange={set("destination")} />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Departure times (comma separated)</span>
          <input type="text" value={form.times} onChange={set("times")} placeholder="6:45 AM, 12:30 PM, 5:15 PM" />
        </label>

        <div className="announce-form__row">
          <label className="field">
            <span className="field__label">Days</span>
            <input type="text" value={form.days} onChange={set("days")} />
          </label>
          <label className="field">
            <span className="field__label">Seats</span>
            <input type="number" min="0" value={form.seats} onChange={set("seats")} />
          </label>
          <label className="field">
            <span className="field__label">Fee (RM / semester)</span>
            <input type="number" min="0" step="0.01" value={form.fee} onChange={set("fee")} />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Notes (optional)</span>
          <input type="text" value={form.notes} onChange={set("notes")} />
        </label>

        <label className="remember">
          <input type="checkbox" checked={form.active} onChange={set("active")} /> Visible to students
        </label>

        <div className="list-row__actions" style={{ marginTop: "0.75rem" }}>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Add route"}
          </button>
          {form.id && (
            <button type="button" className="btn-outline btn-outline--neutral" onClick={() => setForm(EMPTY_FORM)}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default WardenTransportTab;
