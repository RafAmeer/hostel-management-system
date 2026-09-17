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

// --- Warden-facing mock data --------------------------------------------
// These represent ALL students' records rather than one student's own —
// the real Supabase queries for these should drop the `.eq("student_id", ...)`
// filter used on the student side, and RLS policies need to allow a warden
// role to read every row (not just their own).

export const MOCK_ALL_BOOKINGS = [
  { id: 1, student_name: "Amirul Hakim", room_number: "A-101", semester: "S2/2026", status: "pending", created_at: "2026-09-05" },
  { id: 2, student_name: "Nur Sofea", room_number: "B-205", semester: "S2/2026", status: "pending", created_at: "2026-09-05" },
  { id: 3, student_name: "Chong Wei Jie", room_number: "A-102", semester: "S2/2026", status: "approved", created_at: "2026-09-04" },
  { id: 4, student_name: "Farah Adilah", room_number: "B-207", semester: "S2/2026", status: "rejected", created_at: "2026-09-04" },
];

export const MOCK_ALL_COMPLAINTS = [
  { id: 1, student_name: "Nur Sofea", room_number: "B-205", category: "Plumbing", description: "Leaking sink pipe, water pooling on floor", status: "pending", created_at: "2026-09-06" },
  { id: 2, student_name: "Chong Wei Jie", room_number: "A-102", category: "Electrical", description: "Ceiling light flickering", status: "pending", created_at: "2026-09-06" },
  { id: 3, student_name: "Amirul Hakim", room_number: "A-101", category: "Furniture", description: "Wardrobe door hinge broken", status: "in_progress", created_at: "2026-09-05" },
  { id: 4, student_name: "Farah Adilah", room_number: "B-207", category: "Cleanliness", description: "Common bathroom not cleaned since Monday", status: "completed", created_at: "2026-09-04" },
];

// One row per student's current curfew state, rather than a raw log —
// in Supabase this is the kind of thing a view/RPC would compute by
// grouping curfew_logs by student_id and taking the latest scan.
export const MOCK_ALL_CURFEW_STATUSES = [
  { id: 1, student_name: "Amirul Hakim", room_number: "A-101", check_out_time: "18:20", check_in_time: null, status: "out" },
  { id: 2, student_name: "Nur Sofea", room_number: "B-205", check_out_time: "17:05", check_in_time: null, status: "overdue" },
  { id: 3, student_name: "Chong Wei Jie", room_number: "A-102", check_out_time: "15:40", check_in_time: "20:10", status: "checked_in" },
  { id: 4, student_name: "Farah Adilah", room_number: "B-207", check_out_time: "19:00", check_in_time: null, status: "out" },
];

// Full inventory, warden-side (StudentDashboard's RoomsTab only ever sees
// one residence's worth). Used for occupancy stats + the chatbot context.
export const MOCK_ALL_ROOMS = [
  { id: 1, room_number: "A-101", residence: "Main-Campus Hostel", capacity: 2, occupied_count: 1, price: 450 },
  { id: 2, room_number: "A-102", residence: "Main-Campus Hostel", capacity: 2, occupied_count: 2, price: 450 },
  { id: 3, room_number: "B-205", residence: "KTS Village", capacity: 4, occupied_count: 3, price: 350 },
  { id: 4, room_number: "B-207", residence: "KTS Village", capacity: 4, occupied_count: 4, price: 350 },
  { id: 5, room_number: "C-310", residence: "Tropic City", capacity: 2, occupied_count: 0, price: 480 },
  { id: 6, room_number: "C-311", residence: "Tropic City", capacity: 2, occupied_count: 1, price: 480 },
];

// Registered student accounts (role = "student" in `profiles`). A real
// warden query would be `supabase.from("profiles").select("*", { count:
// "exact" }).eq("role", "student")` — this stands in until that's wired up.
export const MOCK_REGISTERED_STUDENTS = [
  { id: 1, full_name: "Amirul Hakim", student_id: "2502040101", eligibility_status: "eligible" },
  { id: 2, full_name: "Nur Sofea", student_id: "2502040102", eligibility_status: "eligible" },
  { id: 3, full_name: "Chong Wei Jie", student_id: "2502040103", eligibility_status: "eligible" },
  { id: 4, full_name: "Farah Adilah", student_id: "2502040104", eligibility_status: "not_eligible" },
  { id: 5, full_name: "Muhammad Danial", student_id: "2502040105", eligibility_status: "eligible" },
];

// --- Finance-facing mock data -------------------------------------------
export const MOCK_ALL_PAYMENTS = [
  { id: 1, student_name: "Amirul Hakim", room_number: "A-101", amount: 450, semester: "S2/2026", status: "paid", due_date: "2026-09-01" },
  { id: 2, student_name: "Nur Sofea", room_number: "B-205", amount: 350, semester: "S2/2026", status: "outstanding", due_date: "2026-09-01" },
  { id: 3, student_name: "Chong Wei Jie", room_number: "A-102", amount: 450, semester: "S2/2026", status: "outstanding", due_date: "2026-09-01" },
  { id: 4, student_name: "Farah Adilah", room_number: "B-207", amount: 350, semester: "S2/2026", status: "paid", due_date: "2026-09-01" },
  { id: 5, student_name: "Muhammad Danial", room_number: "C-311", amount: 480, semester: "S2/2026", status: "overdue", due_date: "2026-08-20" },
];

// --- Technician-facing mock data ----------------------------------------
// Reuses the same maintenance requests as the warden's Complaints tab, with
// an assignment + remarks trail layered on top for the Technician Module.
export const MOCK_ALL_MAINTENANCE = [
  { id: 1, student_name: "Nur Sofea", room_number: "B-205", category: "Plumbing", description: "Leaking sink pipe, water pooling on floor", status: "in_progress", created_at: "2026-09-06", assigned_technician: "Zulkifli Rahman", remarks: [] },
  { id: 2, student_name: "Chong Wei Jie", room_number: "A-102", category: "Electrical", description: "Ceiling light flickering", status: "pending", created_at: "2026-09-06", assigned_technician: "Zulkifli Rahman", remarks: [] },
  { id: 3, student_name: "Amirul Hakim", room_number: "A-101", category: "Furniture", description: "Wardrobe door hinge broken", status: "pending", created_at: "2026-09-05", assigned_technician: "Zulkifli Rahman", remarks: [] },
  { id: 4, student_name: "Farah Adilah", room_number: "B-207", category: "Cleanliness", description: "Common bathroom not cleaned since Monday", status: "completed", created_at: "2026-09-04", assigned_technician: "Zulkifli Rahman", remarks: ["Cleaned and disinfected on 4 Sep."] },
];