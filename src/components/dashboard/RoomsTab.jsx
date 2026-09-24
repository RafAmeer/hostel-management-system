import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import HostelDetailModal from "./HostelDetailModal";

const GENDER_LABEL = { male: "male", female: "female" };

// Pick a residence and a details popup opens with photos, the description
// and the bookable rooms (Supabase-backed), so booking never leaves this
// page. Residence photos/descriptions live in src/data/residences.js.
//
// There's no guaranteed `residence` column on `rooms` yet. If any room has
// one (see supabase/migrations/*), each hostel only lists its own rooms
// (matched on the residence id, e.g. "kts-village"); until then every
// residence shows the full room list, as before.
function roomsForResidence(rooms, residenceId) {
  const hasResidenceData = rooms.some((r) => r.residence);
  return hasResidenceData ? rooms.filter((r) => r.residence === residenceId) : rooms;
}

function RoomsTab({ rooms, residences, studentId, studentGender, semester, onBookingCreated }) {
  const [openResidenceId, setOpenResidenceId] = useState(null);
  const [bookingRoomId, setBookingRoomId] = useState(null);
  const [message, setMessage] = useState("");
  const [roomGenders, setRoomGenders] = useState({});
  const [bookedRoom, setBookedRoom] = useState(null);

  const openResidence = residences.find((r) => r.id === openResidenceId) ?? null;

  // Rooms can't mix genders — look up which gender (if any) already has an
  // approved booking in each room so we can block/label mismatches before
  // a request even goes to the warden.
  useEffect(() => {
    let cancelled = false;
    async function loadOccupantGenders() {
      const { data, error } = await supabase
        .from("bookings")
        .select("room_id, profiles!inner(gender)")
        .eq("status", "approved");
      if (cancelled || error || !data) return;
      const map = {};
      data.forEach((b) => {
        if (b.profiles?.gender) map[b.room_id] = b.profiles.gender;
      });
      setRoomGenders(map);
    }
    loadOccupantGenders();
    return () => {
      cancelled = true;
    };
  }, [rooms]);

  // Auto-dismiss the "Room Booked" toast after a few seconds.
  useEffect(() => {
    if (!bookedRoom) return;
    const timer = setTimeout(() => setBookedRoom(null), 3500);
    return () => clearTimeout(timer);
  }, [bookedRoom]);

  const openDetails = (id) => {
    setMessage("");
    setOpenResidenceId(id);
  };

  const handleBook = async (room) => {
    const occupantGender = roomGenders[room.id];
    if (occupantGender && studentGender && occupantGender !== studentGender) {
      setMessage(
        `Room ${room.room_number} already has ${GENDER_LABEL[occupantGender] ?? occupantGender} students — rooms can't mix genders.`
      );
      return;
    }

    setBookingRoomId(room.id);
    setMessage("");

    const { error } = await supabase.from("bookings").insert({
      student_id: studentId,
      room_id: room.id,
      semester: semester || "S2/2026",
      status: "pending",
    });

    setBookingRoomId(null);

    if (error) {
      setMessage(`Couldn't submit booking: ${error.message}`);
      return;
    }

    setMessage(`Booking request sent for room ${room.room_number}. Track it under Status.`);
    setBookedRoom(room);
    onBookingCreated?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Room Booking</h2>
      <h3 className="panel-heading panel-heading--sub">Residents</h3>

      <div className="residence-grid">
        {residences.map((residence) => {
          const floors = residence.floors ?? [];
          const totalRooms = floors.reduce((sum, f) => {
            const real = rooms.filter((r) => r.floor === f.label);
            return sum + (real.length > 0 ? real.length : (f.rooms ?? []).length);
          }, 0);
          return (
            <div key={residence.id} className="glass-panel residence-card">
              <div className="residence-card__media">
                <img src={residence.cover} alt={residence.name} />
                <span className="residence-card__tag">{residence.tag}</span>
              </div>
              <h4 className="residence-card__name">{residence.name}</h4>
              <p className="residence-card__meta">
                {floors.length} floor{floors.length === 1 ? "" : "s"} · {totalRooms} room
                {totalRooms === 1 ? "" : "s"}
              </p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => openDetails(residence.id)}
                aria-haspopup="dialog"
              >
                Browse floors
              </button>
            </div>
          );
        })}
      </div>

      {openResidence && (
        <HostelDetailModal
          residence={openResidence}
          rooms={roomsForResidence(rooms, openResidence.id)}
          roomGenders={roomGenders}
          bookingRoomId={bookingRoomId}
          message={message}
          onBook={handleBook}
          onClose={() => setOpenResidenceId(null)}
        />
      )}

      {bookedRoom && (
        <div className="toast toast--success" role="status" onClick={() => setBookedRoom(null)}>
          Room Booked ✅ — {bookedRoom.room_number}
        </div>
      )}
    </div>
  );
}

export default RoomsTab;
