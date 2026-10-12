import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  ALL_DAYS,
  DAY_SHORT,
  DIRECTIONS,
  WEEKDAYS,
  describeDays,
  formatTime,
  toInputTime,
} from "../../lib/transport";

const EMPTY_FORM = {
  id: null,
  hostel_id: "",
  route_name: "",
  direction: "to_campus",
  pickup_point: "",
  destination: "Main Campus",
  times: [""],
  days: WEEKDAYS,
  notes: "",
  active: true,
};

// Warden: maintain the fixed shuttle timetable. Students only read it, so
// there are no seat requests to approve any more.
function WardenTransportTab({ schedule, residences, loadError, onChanged, notify }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const offCampus = residences.filter((r) => r.id !== "main-campus");
  const hostelName = (id) => residences.find((r) => r.id === id)?.name ?? id;

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const toggleDay = (d) =>
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort((a, b) => a - b),
    }));

  const setTime = (i, value) =>
    setForm((f) => ({ ...f, times: f.times.map((t, idx) => (idx === i ? value : t)) }));

  const edit = (trip) => {
    setError("");
    setForm({
      id: trip.id,
      hostel_id: trip.hostel_id,
      route_name: trip.route_name,
      direction: trip.direction ?? "to_campus",
      pickup_point: trip.pickup_point ?? "",
      destination: trip.destination ?? "Main Campus",
      times: [toInputTime(trip.departure_time)],
      days: trip.days ?? WEEKDAYS,
      notes: trip.notes ?? "",
      active: trip.active !== false,
    });
    window.scrollTo?.({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.hostel_id) return setError("Choose the hostel this trip serves.");
    if (!form.route_name.trim()) return setError("Give the route a name.");
    if (form.days.length === 0) return setError("Pick at least one day.");
    const times = [...new Set(form.times.map((t) => t.trim()).filter(Boolean))];
    if (times.length === 0) return setError("Add at least one departure time.");

    const base = {
      hostel_id: form.hostel_id,
      route_name: form.route_name.trim(),
      direction: form.direction,
      pickup_point: form.pickup_point.trim() || null,
      destination: form.destination.trim() || "Main Campus",
      days: form.days,
      notes: form.notes.trim() || null,
      active: form.active,
    };

    setSaving(true);
    const result = form.id
      ? await supabase.from("transport_schedule").update({ ...base, departure_time: times[0] }).eq("id", form.id)
      : await supabase.from("transport_schedule").insert(times.map((t) => ({ ...base, departure_time: t })));
    setSaving(false);

    if (result.error) {
      setError(`Couldn't save: ${result.error.message}`);
      return;
    }
    notify?.(form.id ? "Trip updated." : times.length > 1 ? `${times.length} trips added.` : "Trip added.", "success");
    setForm(EMPTY_FORM);
    onChanged?.();
  };

  const toggleActive = async (trip) => {
    const { error: e } = await supabase
      .from("transport_schedule")
      .update({ active: trip.active === false })
      .eq("id", trip.id);
    if (e) return notify?.(`Couldn't update the trip: ${e.message}`, "error");
    onChanged?.();
  };

  const remove = async (trip) => {
    if (!window.confirm(`Delete the ${formatTime(trip.departure_time)} "${trip.route_name}" trip?`)) return;
    const { error: e } = await supabase.from("transport_schedule").delete().eq("id", trip.id);
    if (e) return notify?.(`Couldn't delete the trip: ${e.message}`, "error");
    notify?.("Trip deleted.", "success");
    if (form.id === trip.id) setForm(EMPTY_FORM);
    onChanged?.();
  };

  if (loadError) {
    return (
      <div className="tab">
        <h2 className="tab__title">Transport</h2>
        <p className="message message--info" role="status">
          Run supabase/migrations/2026-10-10_remarks_help_transport_passkeys.sql in the Supabase SQL editor to
          turn on the shuttle timetable. ({loadError})
        </p>
      </div>
    );
  }

  // Group trips by hostel, then keep them in time order.
  const byHostel = new Map();
  for (const t of [...schedule].sort((a, b) => String(a.departure_time).localeCompare(String(b.departure_time)))) {
    if (!byHostel.has(t.hostel_id)) byHostel.set(t.hostel_id, []);
    byHostel.get(t.hostel_id).push(t);
  }

  return (
    <div className="tab">
      <h2 className="tab__title">Transport</h2>
      <p className="tab__subtitle-text">
        The shuttle timetable for hostels outside the main campus. Students see it on their Home and Transport
        tabs — there's nothing for them to book.
      </p>

      {schedule.length === 0 ? (
        <p className="tab__empty">No trips yet. Add the first one below.</p>
      ) : (
        [...byHostel.entries()].map(([hostelId, trips]) => (
          <section key={hostelId}>
            <h3 className="panel-heading panel-heading--sub">{hostelName(hostelId)}</h3>
            <div className="list">
              {trips.map((t) => (
                <div key={t.id} className="list-row list-row--wrap">
                  <div>
                    <p className="list-row__title">
                      {formatTime(t.departure_time)} · {t.route_name}
                    </p>
                    <p className="list-row__meta">
                      {DIRECTIONS[t.direction] ?? "Shuttle"} · {t.pickup_point || "Hostel"} →{" "}
                      {t.destination || "Main Campus"} · {describeDays(t.days)}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </p>
                  </div>
                  <div className="list-row__actions">
                    <span className={"badge badge--" + (t.active === false ? "neutral" : "ok")}>
                      {t.active === false ? "Hidden" : "Active"}
                    </span>
                    <button type="button" className="btn-outline btn-outline--neutral" onClick={() => edit(t)}>
                      Edit
                    </button>
                    <button type="button" className="btn-outline btn-outline--neutral" onClick={() => toggleActive(t)}>
                      {t.active === false ? "Show" : "Hide"}
                    </button>
                    <button type="button" className="btn-outline" onClick={() => remove(t)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <form className="glass-panel announce-form" onSubmit={save} style={{ marginTop: "1.25rem" }}>
        <h3 className="panel-heading">{form.id ? "Edit trip" : "Add trips"}</h3>
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
            <input type="text" value={form.route_name} onChange={set("route_name")} placeholder="KTS Village shuttle" required />
          </label>
          <label className="field">
            <span className="field__label">Direction</span>
            <select value={form.direction} onChange={set("direction")}>
              {Object.entries(DIRECTIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="announce-form__row">
          <label className="field">
            <span className="field__label">Pick-up point</span>
            <input type="text" value={form.pickup_point} onChange={set("pickup_point")} placeholder="Hostel main gate" />
          </label>
          <label className="field">
            <span className="field__label">Destination</span>
            <input type="text" value={form.destination} onChange={set("destination")} />
          </label>
        </div>

        <fieldset className="field time-list">
          <legend className="field__label">{form.id ? "Departure time" : "Departure times"}</legend>
          {form.times.map((t, i) => (
            <div key={i} className="time-list__row">
              <input type="time" value={t} onChange={(e) => setTime(i, e.target.value)} aria-label={`Departure time ${i + 1}`} />
              {!form.id && form.times.length > 1 && (
                <button
                  type="button"
                  className="btn-outline btn-outline--neutral btn-sm"
                  onClick={() => setForm((f) => ({ ...f, times: f.times.filter((_, idx) => idx !== i) }))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {!form.id && (
            <button
              type="button"
              className="link-btn"
              onClick={() => setForm((f) => ({ ...f, times: [...f.times, ""] }))}
            >
              + Add another time
            </button>
          )}
        </fieldset>

        <fieldset className="field">
          <legend className="field__label">Runs on</legend>
          <div className="day-tabs">
            {DAY_SHORT.map((label, d) => (
              <button
                key={label}
                type="button"
                aria-pressed={form.days.includes(d)}
                className={"day-tabs__btn" + (form.days.includes(d) ? " day-tabs__btn--active" : "")}
                onClick={() => toggleDay(d)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="list-row__actions" style={{ marginTop: "0.4rem" }}>
            <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, days: WEEKDAYS }))}>
              Mon–Fri
            </button>
            <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, days: ALL_DAYS }))}>
              Every day
            </button>
          </div>
        </fieldset>

        <label className="field">
          <span className="field__label">Notes (optional)</span>
          <input type="text" value={form.notes} onChange={set("notes")} placeholder="e.g. No service on public holidays" />
        </label>

        <label className="remember">
          <input type="checkbox" checked={form.active} onChange={set("active")} /> Visible to students
        </label>

        <div className="list-row__actions" style={{ marginTop: "0.75rem" }}>
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Add trips"}
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
