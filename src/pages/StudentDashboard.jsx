import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import OverviewTab from "../components/dashboard/OverviewTab";
import RoomsTab from "../components/dashboard/RoomsTab";
import BookingsTab from "../components/dashboard/BookingsTab";
import ComplaintsTab from "../components/dashboard/ComplaintsTab";
import CurfewTab from "../components/dashboard/CurfewTab";
import {
  MOCK_PROFILE,
  MOCK_ROOMS,
  MOCK_BOOKINGS,
  MOCK_COMPLAINTS,
  MOCK_CURFEW_LOGS,
} from "../lib/mockData";

// NOTE: this assumes tables `profiles`, `rooms`, `bookings`, `complaints`,
// and `curfew_logs` exist in Supabase — see supabase_schema.sql for the
// matching CREATE TABLE statements. Until those exist, each section falls
// back to sample data so you can see the dashboard working end to end.

function StudentDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState(MOCK_PROFILE);
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [bookings, setBookings] = useState(MOCK_BOOKINGS);
  const [complaints, setComplaints] = useState(MOCK_COMPLAINTS);
  const [curfewLogs, setCurfewLogs] = useState(MOCK_CURFEW_LOGS);
  const [loading, setLoading] = useState(true);

  const studentId = user?.id;

  const loadAll = async () => {
    setLoading(true);

    const [profileRes, roomsRes, bookingsRes, complaintsRes, curfewRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", studentId).single(),
        supabase.from("rooms").select("*").order("room_number"),
        supabase
          .from("bookings")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("complaints")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("curfew_logs")
          .select("*")
          .eq("student_id", studentId)
          .order("timestamp", { ascending: false }),
      ]);

    if (profileRes.data) setProfile(profileRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (complaintsRes.data) setComplaints(complaintsRes.data);
    if (curfewRes.data) setCurfewLogs(curfewRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (studentId) loadAll();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const renderTab = () => {
    switch (activeTab) {
      case "rooms":
        return (
          <RoomsTab
            rooms={rooms}
            studentId={studentId}
            onBookingCreated={loadAll}
          />
        );
      case "bookings":
        return <BookingsTab bookings={bookings} />;
      case "complaints":
        return (
          <ComplaintsTab
            complaints={complaints}
            studentId={studentId}
            onComplaintCreated={loadAll}
          />
        );
      case "curfew":
        return (
          <CurfewTab
            curfewLogs={curfewLogs}
            studentId={studentId}
            onScanLogged={loadAll}
          />
        );
      default:
        return (
          <OverviewTab
            profile={profile}
            bookings={bookings}
            complaints={complaints}
            curfewLogs={curfewLogs}
          />
        );
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        activeTab={activeTab}
        onSelect={setActiveTab}
        studentName={profile.full_name ?? user?.email}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? (
          <p className="tab__empty">Loading your dashboard…</p>
        ) : (
          renderTab()
        )}
      </main>
    </div>
  );
}

export default StudentDashboard;