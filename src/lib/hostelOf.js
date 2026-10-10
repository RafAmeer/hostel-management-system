// Works out which hostel a booking / complaint belongs to.
//  - warden-added real rooms carry `rooms.residence` (a hostel id)
//  - placeholder-room bookings carry the hostel NAME in `bookings.hostel`
// Returns the residence object (from mergeResidences) or null.
export function residenceForBooking(booking, rooms = [], residences = []) {
  if (!booking) return null;
  if (booking.room_id) {
    const room = rooms.find((r) => r.id === booking.room_id);
    if (room?.residence) {
      const hit = residences.find((r) => r.id === room.residence);
      if (hit) return hit;
    }
  }
  if (booking.hostel) {
    const key = String(booking.hostel).trim().toLowerCase();
    return (
      residences.find((r) => r.id.toLowerCase() === key || r.name.trim().toLowerCase() === key) ?? null
    );
  }
  return null;
}

export function isOffCampus(residence) {
  return Boolean(residence) && residence.id !== "main-campus";
}
