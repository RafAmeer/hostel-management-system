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
  },
];
