// Room occupancy for the warden (user-testing feedback: "view room
// occupancy, vacant rooms, student allocations"). Uses the real `rooms`
// table only — the starter placeholder rooms in data/residences.js are for
// browsing and would make the numbers look fuller than they are.
//
// A room's residents are the students whose profile says they live in it
// (approving a booking writes profiles.room_number + in_hostel = true).
// Occupied beds = the larger of rooms.occupied_count and that resident
// count, so manual counts and system allocations both show up.

const norm = (v) => String(v ?? "").trim().toLowerCase();

export function buildOccupancy(residences = [], rooms = [], students = [], bookings = []) {
  const residents = students.filter((s) => s.in_hostel === true && s.room_number);
  const byRoom = new Map();
  residents.forEach((s) => {
    const k = norm(s.room_number);
    if (!byRoom.has(k)) byRoom.set(k, []);
    byRoom.get(k).push(s);
  });

  const pendingByRoom = new Map();
  bookings
    .filter((b) => b.status === "pending" && b.room_number)
    .forEach((b) => pendingByRoom.set(norm(b.room_number), (pendingByRoom.get(norm(b.room_number)) ?? 0) + 1));

  const nameOf = new Map(residences.map((r) => [r.id, r.name]));
  const placed = new Set();
  const hostelMap = new Map();

  for (const room of rooms) {
    const key = room.residence ?? "unassigned";
    if (!hostelMap.has(key)) hostelMap.set(key, { id: key, name: nameOf.get(key) ?? room.residence ?? "No hostel set", rooms: [] });
    const people = byRoom.get(norm(room.room_number)) ?? [];
    people.forEach((p) => placed.add(p.id));
    const capacity = Number(room.capacity ?? 0);
    const occupied = Math.min(capacity || Infinity, Math.max(Number(room.occupied_count ?? 0), people.length));
    hostelMap.get(key).rooms.push({
      ...room,
      capacity,
      occupied,
      vacant: Math.max(0, capacity - occupied),
      residents: people,
      pending: pendingByRoom.get(norm(room.room_number)) ?? 0,
    });
  }

  const hostels = [...hostelMap.values()]
    .map((h) => {
      h.rooms.sort((a, b) => String(a.floor ?? "").localeCompare(String(b.floor ?? "")) || String(a.room_number).localeCompare(String(b.room_number), undefined, { numeric: true }));
      const beds = h.rooms.reduce((s, r) => s + r.capacity, 0);
      const occupied = h.rooms.reduce((s, r) => s + r.occupied, 0);
      return {
        ...h,
        beds,
        occupied,
        vacant: Math.max(0, beds - occupied),
        fullRooms: h.rooms.filter((r) => r.capacity > 0 && r.vacant === 0).length,
        emptyRooms: h.rooms.filter((r) => r.occupied === 0).length,
        rate: beds ? Math.round((occupied / beds) * 100) : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (k) => hostels.reduce((s, h) => s + (typeof h[k] === "number" ? h[k] : h[k].length), 0);
  const totals = {
    rooms: sum("rooms"),
    beds: sum("beds"),
    occupied: sum("occupied"),
    vacant: sum("vacant"),
    fullRooms: sum("fullRooms"),
    emptyRooms: sum("emptyRooms"),
  };
  totals.rate = totals.beds ? Math.round((totals.occupied / totals.beds) * 100) : 0;

  return { hostels, totals, unplaced: residents.filter((s) => !placed.has(s.id)) };
}
