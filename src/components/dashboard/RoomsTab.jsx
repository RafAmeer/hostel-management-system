import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Static list matching the "Room Dashboard" wireframe — pick a residence
// first, then the real per-room booking grid (Supabase-backed) appears
// below for that step. There's no `residence` column on `rooms` yet, so
// every residence currently shows the same room list; add that column to
// filter it once the schema supports it.
// Only 4 stock hostel photos exist in public/images right now, so they
// repeat across the 6 residences — swap each `image` for the real photo
// of that hostel once you have one.
const RESIDENCES = [
  { id: "main-campus", name: "Main-Campus Hostel", tag: "On-Campus", image: "/images/hostel-1.jpg" },
  { id: "kts-village", name: "KTS Village", tag: "Off-Campus", image: "/images/hostel-2.jpg" },
  { id: "tropic-city", name: "Tropic City", tag: "Off-Campus", image: "/images/hostel-3.jpg" },
  { id: "72-residence", name: "72 Residence", tag: "Off-Campus", image: "/images/hostel-4.jpg" },
  { id: "dbelle-residence", name: "D'belle Residence", tag: "Off-Campus", image: "/images/hostel-1.jpg" },
  { id: "aspace-residence", name: "Aspace Residence", tag: "Off-Campus", image: "/images/hostel-2.jpg" },
];

function RoomsTab({ rooms, studentId, onBookingCreated }) {
  const [selectedResidence, setSelectedResidence] = useState(null);
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
      <h3 className="panel-heading panel-heading--sub">Residents</h3>

      <div className="residence-grid">
        {RESIDENCES.map((residence) => {
          const isSelected = selectedResidence === residence.id;
          return (
            <div
              key={residence.id}
              className={
                "glass-panel residence-card" +
                (isSelected ? " residence-card--selected" : "")
              }
            >
              <div className="residence-card__media">
                <img src={residence.image} alt={residence.name} />
                <span className="residence-card__tag">{residence.tag}</span>
              </div>
              <h4 className="residence-card__name">{residence.name}</h4>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setSelectedResidence(residence.id)}
              >
                {isSelected ? "Selected" : "Select"}
              </button>
            </div>
          );
        })}
      </div>

      {selectedResidence && (
        <>
          <h3 className="panel-heading panel-heading--sub">
            Available Rooms · {RESIDENCES.find((r) => r.id === selectedResidence)?.name}
          </h3>
          {message && <p className="tab__message">{message}</p>}
          <div className="room-grid">
            {rooms.map((room) => {
              const full = room.occupied_count >= room.capacity;
              return (
                <div key={room.id} className="glass-panel room-card">
                  <h3>{room.room_number}</h3>
                  <p className="room-card__meta">
                    {room.occupied_count}/{room.capacity} occupied
                  </p>
                  <p className="room-card__price">RM {room.price}/semester</p>
                  <button
                    type="button"
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
        </>
      )}
    </div>
  );
}

export default RoomsTab;
