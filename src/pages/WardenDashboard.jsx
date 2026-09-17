import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import WardenOverviewTab from "../components/dashboard/WardenOverviewTab";
import WardenBookingsTab from "../components/dashboard/WardenBookingsTab";
import WardenComplaintsTab from "../components/dashboard/WardenComplaintsTab";
import WardenCurfewTab from "../components/dashboard/WardenCurfewTab";
import {
  MOCK_ALL_BOOKINGS,
  MOCK_ALL_COMPLAINTS,
  MOCK_ALL_CURFEW_STATUSES,
  MOCK_ALL_ROOMS,
  MOCK_REGISTERED_STUDENTS,
} from "../lib/mockData";

const NAV_ITEMS = [
  { key: "overview", label: "Overview" },
  { key: "bookings", label: "Room Bookings" },
  { key: "complaints", label: "Complaints" },
  { key: "curfew", label: "Curfew" },
];

// NOTE: this assumes tables `bookings` and `complaints` exist in Supabase
// with RLS policies that let a warden read every row (not just their own,
// like the student-side queries do). `curfew_logs` needs a view/RPC that
// collapses each student's log down to one current status row before it's
// worth swapping in here — sample data stands in for that until then.
//
// Approve/reject/assign/check-in update local state immediately
// (optimistic) so the workflow is testable right now, and best-effort
// mirror the change to Supabase in the background.

function WardenDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [bookings, setBookings] = useState(MOCK_ALL_BOOKINGS);
  const [complaints, setComplaints] = useState(MOCK_ALL_COMPLAINTS);
  const [curfewStatuses, setCurfewStatuses] = useState(MOCK_ALL_CURFEW_STATUSES);
  // Rooms + registered students: same "mock until the real table/RLS is
  // ready" story as bookings/complaints above. These feed room occupancy
  // and headcount stats into both the charts and the AI chat assistant.
  const [rooms, setRooms] = useState(MOCK_ALL_ROOMS);
  const [students, setStudents] = useState(MOCK_REGISTERED_STUDENTS);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);

    const [bookingsRes, complaintsRes, roomsRes, studentsRes] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("complaints").select("*").order("created_at", { ascending: false }),
      supabase.from("rooms").select("*"),
      supabase.from("profiles").select("*").eq("role", "student"),
    ]);

    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (complaintsRes.data) setComplaints(complaintsRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (studentsRes.data) setStudents(studentsRes.data);

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = (id) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)));
    supabase.from("bookings").update({ status: "approved" }).eq("id", id);
  };

  const handleReject = (id) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "rejected" } : b)));
    supabase.from("bookings").update({ status: "rejected" }).eq("id", id);
  };

  const handleAssign = (id) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: "in_progress" } : c)));
    supabase.from("complaints").update({ status: "in_progress" }).eq("id", id);
  };

  const handleComplete = (id) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: "completed" } : c)));
    supabase.from("complaints").update({ status: "completed" }).eq("id", id);
  };

  const handleCheckIn = (id) => {
    const now = new Date().toTimeString().slice(0, 5);
    setCurfewStatuses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "checked_in", check_in_time: now } : s))
    );
  };

  const renderTab = () => {
    switch (activeTab) {
      case "bookings":
        return <WardenBookingsTab bookings={bookings} onApprove={handleApprove} onReject={handleReject} />;
      case "complaints":
        return <WardenComplaintsTab complaints={complaints} onAssign={handleAssign} onComplete={handleComplete} />;
      case "curfew":
        return <WardenCurfewTab curfewStatuses={curfewStatuses} onCheckIn={handleCheckIn} />;
      default:
        return (
          <WardenOverviewTab
            bookings={bookings}
            complaints={complaints}
            curfewStatuses={curfewStatuses}
            rooms={rooms}
            students={students}
          />
        );
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={user?.email ?? "Warden"}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? <p className="tab__empty">Loading warden dashboard&hellip;</p> : renderTab()}
      </main>
    </div>
  );
}

export default WardenDashboard;
