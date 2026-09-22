import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { RESIDENCES } from "../../data/residences";
import HostelDetailModal from "./HostelDetailModal";

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

function RoomsTab({ rooms, studentId, onBookingCreated }) {
  const [openResidenceId, setOpenResidenceId] = useState(null);
  const [bookingRoomId, setBookingRoomId] = useState(null);
  const [message, setMessage] = useState("");

  const openResidence = RESIDENCES.find((r) => r.id === openResidenceId) ?? null;

  const openDetails = (id) => {
    setMessage("");
    setOpenResidenceId(id);
  };

  const handleBook = async (room) => {
    setBookingRoomId(room.id);
    setMessage("");

    const { error } = await supabase.from("bookings").insert({
      student_id: studentId,
      room_id: room.id,
      semester: "S2/2026",
      status: "pending",
    });

    setBookingRoomId(null);

    if (error) {
      setMessage(`Couldn't submit booking: ${error.message}`);
      return;
    }

    setMessage(`Booking request sent for room ${room.room_number}. Track it under Status.`);
    onBookingCreated?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Room Booking</h2>
      <h3 className="panel-heading panel-heading--sub">Residents</h3>

      <div className="residence-grid">
        {RESIDENCES.map((residence) => (
          <div key={residence.id} className="glass-panel residence-card">
            <div className="residence-card__media">
              <img src={residence.cover} alt={residence.name} />
              <span className="residence-card__tag">{residence.tag}</span>
            </div>
            <h4 className="residence-card__name">{residence.name}</h4>
            <button
              type="button"
              className="primary-btn"
              onClick={() => openDetails(residence.id)}
              aria-haspopup="dialog"
            >
              View details
            </button>
          </div>
        ))}
      </div>

      {openResidence && (
        <HostelDetailModal
          residence={openResidence}
          rooms={roomsForResidence(rooms, openResidence.id)}
          bookingRoomId={bookingRoomId}
          message={message}
          onBook={handleBook}
          onClose={() => setOpenResidenceId(null)}
        />
      )}
    </div>
  );
}

export default RoomsTab;
