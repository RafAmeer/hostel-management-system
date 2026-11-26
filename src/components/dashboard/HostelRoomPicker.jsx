import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { mergeResidences } from "../../lib/residences";

export const ROOM_NOT_LISTED = "__not_listed__";

// Hostel -> Floor -> Room dropdowns for the student's CURRENT room on the
// Complete Profile / Edit profile form, so students pick it instead of
// typing it. Uses the same hostel list as the Rooms page (static
// placeholder hostels merged with warden-added `hostels` rows) and, per
// floor, the warden-added `rooms` rows when there are any, otherwise the
// placeholder rooms — same rule as HostelDetailModal.
//
// If a student's room genuinely isn't in the list, "My room isn't listed"
// reveals a small text box so they're never blocked.
function roomsOnFloor(realRooms, residenceId, floor) {
  if (!floor) return [];
  const real = realRooms.filter((r) => r.residence === residenceId && r.floor === floor.label);
  return real.length ? real : floor.rooms ?? [];
}

function HostelRoomPicker({ hostel, roomNumber, gender, onChange }) {
  const [residences, setResidences] = useState(() => mergeResidences([]));
  const [realRooms, setRealRooms] = useState([]);
  const [hostelId, setHostelId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [roomChoice, setRoomChoice] = useState("");
  const [typedRoom, setTypedRoom] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: hostelRows }, { data: roomRows }] = await Promise.all([
        supabase.from("hostels").select("*"),
        supabase.from("rooms").select("id, room_number, residence, floor, gender"),
      ]);
      if (cancelled) return;
      setResidences(mergeResidences(hostelRows ?? []));
      setRealRooms(roomRows ?? []);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fill from a saved profile once the lists are loaded.
  useEffect(() => {
    if (!ready || !hostel) return;
    const key = hostel.trim().toLowerCase();
    const res = residences.find((r) => r.name.toLowerCase() === key || r.id.toLowerCase() === key);
    if (!res) return;
    setHostelId(res.id);
    if (!roomNumber) return;
    for (const f of res.floors ?? []) {
      if (roomsOnFloor(realRooms, res.id, f).some((r) => r.room_number === roomNumber)) {
        setFloorId(f.id);
        setRoomChoice(roomNumber);
        return;
      }
    }
    setRoomChoice(ROOM_NOT_LISTED);
    setTypedRoom(roomNumber);
    // only on first load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const residence = residences.find((r) => r.id === hostelId) ?? null;
  const floor = residence?.floors?.find((f) => f.id === floorId) ?? null;

  // Only rooms for the student's gender (or mixed/unspecified rooms).
  const rooms = useMemo(() => {
    const all = roomsOnFloor(realRooms, hostelId, floor);
    if (!gender) return all;
    const fit = all.filter((r) => !r.gender || r.gender === gender);
    return fit.length ? fit : all;
  }, [realRooms, hostelId, floor, gender]);

  const report = (nextResidence, nextRoom) =>
    onChange({ hostel: nextResidence?.name ?? "", roomNumber: nextRoom });

  return (
    <div className="profile-form__room hostel-room-picker">
      <label className="field">
        <span className="field__label">Hostel</span>
        <select
          value={hostelId}
          onChange={(e) => {
            const next = residences.find((r) => r.id === e.target.value) ?? null;
            setHostelId(e.target.value);
            setFloorId("");
            setRoomChoice("");
            setTypedRoom("");
            report(next, "");
          }}
          required
        >
          <option value="" disabled>
            {ready ? "Select your hostel" : "Loading hostels…"}
          </option>
          {residences.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {residence && (
        <label className="field">
          <span className="field__label">Floor / block (optional)</span>
          <select
            value={floorId}
            onChange={(e) => {
              setFloorId(e.target.value);
              setRoomChoice("");
              setTypedRoom("");
              report(residence, "");
            }}
          >
            <option value="">Select floor</option>
            {(residence.floors ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {residence && (floor || roomChoice === ROOM_NOT_LISTED) && (
        <label className="field">
          <span className="field__label">Room (optional)</span>
          <select
            value={roomChoice}
            onChange={(e) => {
              setRoomChoice(e.target.value);
              setTypedRoom("");
              report(residence, e.target.value === ROOM_NOT_LISTED ? "" : e.target.value);
            }}
          >
            <option value="">Select room</option>
            {rooms.map((r) => (
              <option key={r.id ?? r.room_number} value={r.room_number}>
                {r.room_number}
              </option>
            ))}
            <option value={ROOM_NOT_LISTED}>My room isn't listed</option>
          </select>
        </label>
      )}

      {residence && !floor && roomChoice !== ROOM_NOT_LISTED && (
        <button
          type="button"
          className="link-btn hostel-room-picker__link"
          onClick={() => setRoomChoice(ROOM_NOT_LISTED)}
        >
          Can't find your floor? Type your room instead
        </button>
      )}

      {roomChoice === ROOM_NOT_LISTED && (
        <label className="field">
          <span className="field__label">Room number</span>
          <input
            type="text"
            value={typedRoom}
            onChange={(e) => {
              setTypedRoom(e.target.value);
              report(residence, e.target.value.trim());
            }}
            placeholder="e.g. A-101"
          />
        </label>
      )}
    </div>
  );
}

export default HostelRoomPicker;
