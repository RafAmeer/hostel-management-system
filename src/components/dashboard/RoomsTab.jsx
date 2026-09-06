import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function RoomsTab({ rooms, studentId, onBookingCreated }) {
  const [bookingRoomId, setBookingRoomId] = useState(null);
  const [message, setMessage] = useState("");

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

    setMessage(`Booking request sent for room ${room.room_number}.`);
    onBookingCreated?.();
  };

  return (
    <div className="tab">
      <h2 className="tab__title">Room Booking</h2>
      {message && <p className="tab__message">{message}</p>}

      <div className="room-grid">
        {rooms.map((room) => {
          const full = room.occupied_count >= room.capacity;
          return (
            <div key={room.id} className="room-card">
              <h3>{room.room_number}</h3>
              <p className="room-card__meta">
                {room.occupied_count}/{room.capacity} occupied
              </p>
              <p className="room-card__price">RM {room.price}/semester</p>
              <button
                className="primary-btn"
                disabled={full || bookingRoomId === room.id}
                onClick={() => handleBook(room)}
              >
                {full
                  ? "Full"
                  : bookingRoomId === room.id
                  ? "Booking…"
                  : "Request Booking"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RoomsTab;