// Fallback data shown when the matching Supabase table doesn't exist yet
// or a query fails — lets the dashboard render while you set up the schema.
// See supabase_schema.sql for the tables this dashboard expects.

export const MOCK_PROFILE = {
  full_name: "Ashraf Fakhrul",
  student_id: "2502040448",
  eligibility_status: "eligible",
  room_number: null,
};

export const MOCK_ROOMS = [
  { id: 1, room_number: "A-101", capacity: 2, occupied_count: 1, price: 450 },
  { id: 2, room_number: "A-102", capacity: 2, occupied_count: 0, price: 450 },
  { id: 3, room_number: "B-205", capacity: 4, occupied_count: 3, price: 350 },
  { id: 4, room_number: "B-207", capacity: 4, occupied_count: 4, price: 350 },
];

export const MOCK_BOOKINGS = [
  {
    id: 1,
    room_number: "A-101",
    semester: "S2/2026",
    status: "pending",
    created_at: "2026-08-20",
  },
];

export const MOCK_COMPLAINTS = [
  {
    id: 1,
    category: "Plumbing",
    description: "Sink in room A-101 is leaking",
    status: "in_progress",
    created_at: "2026-08-25",
  },
  {
    id: 2,
    category: "Electrical",
    description: "Ceiling light flickering",
    status: "completed",
    created_at: "2026-08-10",
  },
];

export const MOCK_CURFEW_LOGS = [
  { id: 1, scan_type: "check_out", timestamp: "2026-09-02 18:30" },
  { id: 2, scan_type: "check_in", timestamp: "2026-09-01 22:10" },
  { id: 3, scan_type: "check_out", timestamp: "2026-09-01 17:05" },
];