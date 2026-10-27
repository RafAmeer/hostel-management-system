import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Lets the warden add new hostels (which show up for students immediately —
// see src/lib/residences.js:mergeResidences) and add/remove rooms within a
// hostel's floors. Existing starter hostels (src/data/residences.js) can
// have new floors/rooms added the same way; their id just has to match
// (e.g. "main-campus") for edits to merge onto them instead of creating a
// duplicate card.
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function WardenHostelsTab({ residences, rooms, onChanged }) {
  const [editingId, setEditingId] = useState("");
  const [hostelForm, setHostelForm] = useState({
    name: "",
    tag: "Off-Campus",
    description: "",
    cover: "",
    facilities: "",
    galleryUrls: "",
    mapQuery: "",
    floorLabels: "",
  });
  const [roomForm, setRoomForm] = useState({
    residenceId: residences[0]?.id ?? "",
    floor: "",
    roomNumber: "",
    capacity: "2",
    price: "",
    gender: "",
  });
  const [savingHostel, setSavingHostel] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSelectForEdit = (id) => {
    setEditingId(id);
    setMessage("");
    setError("");
    if (!id) {
      setHostelForm({ name: "", tag: "Off-Campus", description: "", cover: "", facilities: "", galleryUrls: "", mapQuery: "", floorLabels: "" });
      return;
    }
    const r = residences.find((res) => res.id === id);
    if (!r) return;
    setHostelForm({
      name: r.name ?? "",
      tag: r.tag ?? "",
      description: r.description ?? "",
      cover: r.cover ?? "",
      facilities: (r.facilities ?? []).join(", "),
      galleryUrls: (r.gallery ?? []).map((g) => g.src ?? g).join(", "),
      mapQuery: r.mapQuery ?? "",
      floorLabels: (r.floors ?? []).map((f) => f.label).join(", "),
    });
  };

  const handleAddHostel = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!hostelForm.name.trim()) return setError("Enter a hostel name.");

    setSavingHostel(true);
    // Editing keeps the same id (so it merges onto the existing card via
    // mergeResidences instead of creating a duplicate); a brand-new hostel
    // gets a fresh id from its name.
    const id = editingId || slugify(hostelForm.name);
    const floorLabels = hostelForm.floorLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { error: insertError } = await supabase.from("hostels").upsert({
      id,
      name: hostelForm.name.trim(),
      tag: hostelForm.tag.trim() || null,
      description: hostelForm.description.trim() || null,
      cover: hostelForm.cover.trim() || null,
      facilities: hostelForm.facilities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      gallery: hostelForm.galleryUrls
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((src) => ({ src, caption: "" })),
      map_query: hostelForm.mapQuery.trim() || hostelForm.name.trim(),
      floors: floorLabels.map((label, i) => ({ id: `floor-${slugify(label) || i}`, label })),
    });

    setSavingHostel(false);
    if (insertError) return setError(`Couldn't save hostel: ${insertError.message}`);

    setMessage(editingId ? `Hostel "${hostelForm.name}" updated.` : `Hostel "${hostelForm.name}" saved.`);
    if (!editingId) {
      setHostelForm({ name: "", tag: "Off-Campus", description: "", cover: "", facilities: "", galleryUrls: "", mapQuery: "", floorLabels: "" });
    }
    onChanged?.();
  };

  const handleAddRoom = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!roomForm.residenceId || !roomForm.floor.trim() || !roomForm.roomNumber.trim()) {
      return setError("Select a hostel and fill in floor + room number.");
    }

    setSavingRoom(true);
    const { error: insertError } = await supabase.from("rooms").insert({
      residence: roomForm.residenceId,
      floor: roomForm.floor.trim(),
      room_number: roomForm.roomNumber.trim(),
      capacity: Number(roomForm.capacity) || 2,
      price: roomForm.price ? Number(roomForm.price) : null,
      occupied_count: 0,
      gender: roomForm.gender || null,
    });

    setSavingRoom(false);
    if (insertError) return setError(`Couldn't add room: ${insertError.message}`);

    setMessage(`Room ${roomForm.roomNumber} added.`);
    setRoomForm((f) => ({ ...f, roomNumber: "", price: "" }));
    onChanged?.();
  };

  const handleDeleteRoom = async (id) => {
    await supabase.from("rooms").delete().eq("id", id);
    onChanged?.();
  };

  const handleUpdateRoom = async (id, patch) => {
    setError("");
    const { error: updateError } = await supabase.from("rooms").update(patch).eq("id", id);
    if (updateError) return setError(`Couldn't update room: ${updateError.message}`);
    setMessage("Room updated.");
    onChanged?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Hostels &amp; Rooms</h2>

      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="message message--info" role="status">
          {message}
        </p>
      )}

      <div className="warden-hostels-grid">
        <form className="glass-panel form-panel" onSubmit={handleAddHostel}>
          <h3 className="panel-heading">{editingId ? "Edit hostel" : "Add a hostel"}</h3>
          <label className="field">
            <span className="field__label">Edit an existing hostel (optional)</span>
            <select value={editingId} onChange={(e) => handleSelectForEdit(e.target.value)}>
              <option value="">— New hostel —</option>
              {residences.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Name</span>
            <input
              type="text"
              value={hostelForm.name}
              onChange={(e) => setHostelForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Riverside Hostel"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Tag</span>
            <input
              type="text"
              value={hostelForm.tag}
              onChange={(e) => setHostelForm((f) => ({ ...f, tag: e.target.value }))}
              placeholder="On-Campus / Off-Campus"
            />
          </label>
          <label className="field">
            <span className="field__label">Description</span>
            <input
              type="text"
              value={hostelForm.description}
              onChange={(e) => setHostelForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Cover photo URL</span>
            <input
              type="text"
              value={hostelForm.cover}
              onChange={(e) => setHostelForm((f) => ({ ...f, cover: e.target.value }))}
              placeholder="/images/hostel-1.jpg"
            />
          </label>
          <label className="field">
            <span className="field__label">Facilities (comma-separated)</span>
            <input
              type="text"
              value={hostelForm.facilities}
              onChange={(e) => setHostelForm((f) => ({ ...f, facilities: e.target.value }))}
              placeholder="Wi-Fi, Laundry, Parking"
            />
          </label>
          <label className="field">
            <span className="field__label">Gallery photo URLs (comma-separated)</span>
            <input
              type="text"
              value={hostelForm.galleryUrls}
              onChange={(e) => setHostelForm((f) => ({ ...f, galleryUrls: e.target.value }))}
              placeholder="/images/hostel-1.jpg, /images/hostel-5.png"
            />
          </label>
          {hostelForm.galleryUrls.trim() && (
            <div className="gallery-preview">
              {hostelForm.galleryUrls
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((src, i) => (
                  <div key={src + i} className="gallery-preview__item">
                    <img src={src} alt="" />
                    <button
                      type="button"
                      className="gallery-preview__remove"
                      aria-label="Remove this photo"
                      onClick={() =>
                        setHostelForm((f) => ({
                          ...f,
                          galleryUrls: f.galleryUrls
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean)
                            .filter((_, idx) => idx !== i)
                            .join(", "),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
            </div>
          )}
          <label className="field">
            <span className="field__label">Floors (comma-separated)</span>
            <input
              type="text"
              value={hostelForm.floorLabels}
              onChange={(e) => setHostelForm((f) => ({ ...f, floorLabels: e.target.value }))}
              placeholder="Ground Floor, 1st Floor, 2nd Floor"
            />
          </label>
          <label className="field">
            <span className="field__label">Map search text</span>
            <input
              type="text"
              value={hostelForm.mapQuery}
              onChange={(e) => setHostelForm((f) => ({ ...f, mapQuery: e.target.value }))}
              placeholder="Defaults to the hostel name"
            />
          </label>
          <button type="submit" className="primary-btn" disabled={savingHostel}>
            {savingHostel ? "Saving…" : editingId ? "Save changes" : "Save hostel"}
          </button>
        </form>

        <form className="glass-panel form-panel" onSubmit={handleAddRoom}>
          <h3 className="panel-heading">Add a room</h3>
          <label className="field">
            <span className="field__label">Hostel</span>
            <select
              value={roomForm.residenceId}
              onChange={(e) => setRoomForm((f) => ({ ...f, residenceId: e.target.value, floor: "" }))}
              required
            >
              {residences.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Floor</span>
            {/* A dropdown, not free text: students only see a room when its
                floor exactly matches one of the hostel's floors, so a typo
                ("Ground Floor" vs "Block A") used to hide the room. */}
            <select
              value={roomForm.floor}
              onChange={(e) => setRoomForm((f) => ({ ...f, floor: e.target.value }))}
              required
            >
              <option value="" disabled>
                Select a floor
              </option>
              {floorLabelsOf(residences, roomForm.residenceId).map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            {floorLabelsOf(residences, roomForm.residenceId).length === 0 && (
              <span className="list-row__meta">This hostel has no floors yet. Add them under "Edit an existing hostel" first.</span>
            )}
          </label>
          <label className="field">
            <span className="field__label">Room number</span>
            <input
              type="text"
              value={roomForm.roomNumber}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomNumber: e.target.value }))}
              placeholder="e.g. MC-G05"
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Capacity</span>
            <input
              type="number"
              min={1}
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Price (RM/semester)</span>
            <input
              type="number"
              min={0}
              value={roomForm.price}
              onChange={(e) => setRoomForm((f) => ({ ...f, price: e.target.value }))}
            />
          </label>
          <label className="field">
            <span className="field__label">Gender restriction</span>
            <select value={roomForm.gender} onChange={(e) => setRoomForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">None yet</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <button type="submit" className="primary-btn" disabled={savingRoom}>
            {savingRoom ? "Saving…" : "Add room"}
          </button>
        </form>
      </div>

      <h3 className="panel-heading" style={{ marginTop: "1.5rem" }}>
        Existing rooms
      </h3>
      {rooms.length === 0 ? (
        <p className="tab__empty">No rooms added yet — use the form above.</p>
      ) : (
        <div className="list">
          {rooms.map((room) => (
            <RoomRow
              key={room.id}
              room={room}
              hostelName={residences.find((r) => r.id === room.residence)?.name ?? room.residence ?? "—"}
              floorOptions={floorLabelsOf(residences, room.residence)}
              onSave={(patch) => handleUpdateRoom(room.id, patch)}
              onDelete={() => handleDeleteRoom(room.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function floorLabelsOf(residences, residenceId) {
  const r = residences.find((res) => res.id === residenceId);
  return (r?.floors ?? []).map((f) => f.label).filter(Boolean);
}

function RoomRow({ room, hostelName, floorOptions = [], onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [capacity, setCapacity] = useState(String(room.capacity ?? 2));
  const [price, setPrice] = useState(room.price != null ? String(room.price) : "");
  const [gender, setGender] = useState(room.gender ?? "");
  const [floor, setFloor] = useState(room.floor ?? "");

  const save = () => {
    onSave({
      floor: floor.trim() || null,
      capacity: Number(capacity) || 2,
      price: price ? Number(price) : null,
      gender: gender || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="list-row list-row--wrap">
        <div className="room-edit-fields">
          <label className="field field--compact">
            <span className="field__label">Floor</span>
            <select value={floor} onChange={(e) => setFloor(e.target.value)}>
              <option value="">No floor</option>
              {floor && !floorOptions.includes(floor) && (
                <option value={floor}>{floor} (not a floor of this hostel)</option>
              )}
              {floorOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--compact">
            <span className="field__label">Capacity</span>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </label>
          <label className="field field--compact">
            <span className="field__label">Price</span>
            <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="field field--compact">
            <span className="field__label">Gender</span>
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">None</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>
        <div className="list-row__actions">
          <button type="button" className="primary-btn btn-sm" onClick={save}>
            Save
          </button>
          <button type="button" className="btn-outline btn-outline--neutral" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-row">
      <div>
        <p className="list-row__title">
          {room.room_number} — {hostelName}
        </p>
        <p className="list-row__meta">
          {room.floor ?? "No floor set"} · {room.occupied_count ?? 0}/{room.capacity} occupied
          {room.price != null ? ` · RM ${room.price}/semester` : ""}
          {room.gender ? ` · ${room.gender}` : ""}
          {(!room.residence || !room.floor || !floorOptions.includes(room.floor)) && (
            <span className="badge badge--danger" style={{ marginLeft: "0.5rem" }}>
              Hidden from students — set its hostel floor
            </span>
          )}
        </p>
      </div>
      <div className="list-row__actions">
        <button type="button" className="btn-outline btn-outline--neutral" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" className="btn-outline btn-outline--danger" onClick={onDelete}>
          Remove
        </button>
      </div>
    </div>
  );
}

export default WardenHostelsTab;
