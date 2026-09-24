import { assetUrl } from "../lib/assetUrl";

// Static details for the six residences shown on the Rooms page. The
// booking flow itself is still Supabase-backed (rooms + bookings tables);
// this file only feeds the "hostel details" popup.
//
// PLACEHOLDER CONTENT: the descriptions, facilities and photo choices below
// are stand-ins so the popup can be built and tested. Replace them with the
// real details for each hostel. To use real room photos, put them in
// public/images/residences/<id>/ and list them under `gallery` as
// "/images/residences/<id>/room-1.jpg" (only the 6 general hostel photos
// exist right now, so they are reused across residences).
const img = (name) => assetUrl(`/images/${name}`);

// Deterministic mock rooms per floor, purely for browsing/preview until a
// real `rooms` row exists for that residence+floor (see RoomsTab.jsx:
// roomsForFloor prefers real Supabase rows and only falls back to these).
// Warden-added rooms (Warden > Hostels) always win over this mock data.
function mockRooms(prefix, count, basePrice, genders) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    return {
      room_number: `${prefix}${String(n).padStart(2, "0")}`,
      capacity: n % 3 === 0 ? 4 : 2,
      occupied_count: n % 4 === 0 ? (n % 3 === 0 ? 4 : 2) : n % 2,
      price: basePrice + (n % 3 === 0 ? 40 : 0),
      gender: genders[i % genders.length],
      mock: true,
    };
  });
}

function floorsFor(config) {
  // config: [{ label, prefix, roomCount, price, genders }]
  return config.map((f, i) => ({
    id: `floor-${i + 1}`,
    label: f.label,
    rooms: mockRooms(f.prefix, f.roomCount, f.price, f.genders),
  }));
}

export const RESIDENCES = [
  {
    id: "main-campus",
    name: "Main-Campus Hostel",
    tag: "On-Campus",
    cover: img("hostel-1.jpg"),
    description:
      "On-campus accommodation within walking distance of lecture halls, the library and the cafeteria. A good fit if you want the shortest trip to class.",
    facilities: ["Wi-Fi", "Study area", "Laundry", "24-hour security"],
    gallery: [
      { src: img("hostel-1.jpg"), caption: "Hostel building" },
      { src: img("hostel-5.png"), caption: "Room interior" },
      { src: img("hostel-6.png"), caption: "Common area" },
    ],
    mapQuery: "iCATS University College, Kuching",
    floors: floorsFor([
      { label: "Ground Floor", prefix: "MC-G", roomCount: 4, price: 420, genders: ["male"] },
      { label: "1st Floor", prefix: "MC-1", roomCount: 4, price: 420, genders: ["male"] },
      { label: "2nd Floor", prefix: "MC-2", roomCount: 4, price: 450, genders: ["female"] },
    ]),
  },
  {
    id: "kts-village",
    name: "KTS Village",
    tag: "Off-Campus",
    cover: img("hostel-2.jpg"),
    description:
      "Off-campus village-style housing with a quieter setting. Suitable for students who prefer more space and are comfortable commuting.",
    facilities: ["Wi-Fi", "Parking", "Laundry", "Shared kitchen"],
    gallery: [
      { src: img("hostel-2.jpg"), caption: "Hostel building" },
      { src: img("hostel-6.png"), caption: "Room interior" },
      { src: img("hostel-3.jpg"), caption: "Common area" },
    ],
    mapQuery: "KTS Village, Kuching",
    floors: floorsFor([
      { label: "Block A", prefix: "KV-A", roomCount: 3, price: 350, genders: ["male", "female"] },
      { label: "Block B", prefix: "KV-B", roomCount: 3, price: 350, genders: ["female"] },
    ]),
  },
  {
    id: "tropic-city",
    name: "Tropic City",
    tag: "Off-Campus",
    cover: img("hostel-3.jpg"),
    description:
      "Apartment-style residence in a residential area with shops and food nearby. Rooms are shared between a small number of students.",
    facilities: ["Wi-Fi", "Air-conditioning", "Laundry", "Nearby shops"],
    gallery: [
      { src: img("hostel-3.jpg"), caption: "Building exterior" },
      { src: img("hostel-5.png"), caption: "Room interior" },
      { src: img("hostel-4.jpg"), caption: "Common area" },
    ],
    mapQuery: "Tropic City, Kuching",
    floors: floorsFor([
      { label: "Level 1", prefix: "TC-1", roomCount: 3, price: 380, genders: ["male"] },
      { label: "Level 2", prefix: "TC-2", roomCount: 3, price: 380, genders: ["male"] },
      { label: "Level 3", prefix: "TC-3", roomCount: 3, price: 400, genders: ["female"] },
      { label: "Level 4", prefix: "TC-4", roomCount: 3, price: 400, genders: ["female"] },
    ]),
  },
  {
    id: "72-residence",
    name: "72 Residence",
    tag: "Off-Campus",
    cover: img("hostel-4.jpg"),
    description:
      "Compact residence with simple, practical rooms. A budget-friendly option for students who mostly need a place to sleep and study.",
    facilities: ["Wi-Fi", "Study area", "Laundry"],
    gallery: [
      { src: img("hostel-4.jpg"), caption: "Building exterior" },
      { src: img("hostel-6.png"), caption: "Room interior" },
      { src: img("hostel-2.jpg"), caption: "Common area" },
    ],
    mapQuery: "72 Residence, Kuching",
    floors: floorsFor([
      { label: "Ground Floor", prefix: "SR-G", roomCount: 5, price: 300, genders: ["male", "female"] },
      { label: "1st Floor", prefix: "SR-1", roomCount: 5, price: 300, genders: ["male", "female"] },
    ]),
  },
  {
    id: "dbelle-residence",
    name: "D'belle Residence",
    tag: "Off-Campus",
    cover: img("hostel-5.png"),
    description:
      "Modern residence with furnished rooms and shared lounge space. Popular with students who want a more comfortable setup.",
    facilities: ["Wi-Fi", "Air-conditioning", "Lounge", "Laundry"],
    gallery: [
      { src: img("hostel-5.png"), caption: "Building exterior" },
      { src: img("hostel-1.jpg"), caption: "Room interior" },
      { src: img("hostel-3.jpg"), caption: "Common area" },
    ],
    mapQuery: "D'belle Residence, Kuching",
    floors: floorsFor([
      { label: "Floor 1", prefix: "DB-1", roomCount: 3, price: 480, genders: ["female"] },
      { label: "Floor 2", prefix: "DB-2", roomCount: 3, price: 480, genders: ["female"] },
      { label: "Floor 3", prefix: "DB-3", roomCount: 3, price: 500, genders: ["male"] },
    ]),
  },
  {
    id: "aspace-residence",
    name: "Aspace Residence",
    tag: "Off-Campus",
    cover: img("hostel-6.png"),
    description:
      "Newer residence with bright, open rooms and shared study spaces. Good for students who like a calm environment to focus.",
    facilities: ["Wi-Fi", "Study area", "Air-conditioning", "Laundry"],
    gallery: [
      { src: img("hostel-6.png"), caption: "Building exterior" },
      { src: img("hostel-2.jpg"), caption: "Room interior" },
      { src: img("hostel-4.jpg"), caption: "Common area" },
    ],
    mapQuery: "Aspace Residence, Kuching",
    floors: floorsFor([
      { label: "Floor 1", prefix: "AS-1", roomCount: 2, price: 460, genders: ["male"] },
      { label: "Floor 2", prefix: "AS-2", roomCount: 2, price: 460, genders: ["male"] },
      { label: "Floor 3", prefix: "AS-3", roomCount: 2, price: 460, genders: ["female"] },
      { label: "Floor 4", prefix: "AS-4", roomCount: 2, price: 460, genders: ["female"] },
      { label: "Floor 5", prefix: "AS-5", roomCount: 2, price: 490, genders: ["female"] },
    ]),
  },
];
