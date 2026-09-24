import { useEffect, useMemo, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import WardenOverviewTab from "../components/dashboard/WardenOverviewTab";
import WardenBookingsTab from "../components/dashboard/WardenBookingsTab";
import WardenComplaintsTab from "../components/dashboard/WardenComplaintsTab";
import WardenCurfewTab from "../components/dashboard/WardenCurfewTab";
import WardenHostelsTab from "../components/dashboard/WardenHostelsTab";
import HostelChatbot from "../components/dashboard/HostelChatbot";
import ProfileTab from "../components/dashboard/ProfileTab";
import { buildHostelAnalytics } from "../lib/analytics";
import { mergeResidences } from "../lib/residences";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "bookings", label: "Room Bookings", icon: "status" },
  { key: "hostels", label: "Hostels & Rooms", icon: "rooms" },
  { key: "complaints", label: "Complaints", icon: "complaint" },
  { key: "curfew", label: "Curfew", icon: "curfew" },
  { key: "profile", label: "Profile", icon: "profile" },
];

// NOTE: this assumes tables `bookings` and `complaints` exist in Supabase
// with RLS policies that let a warden read every row (not just their own,
// like the student-side queries do). `curfew_logs` needs a view/RPC that
// collapses each student's log down to one current status row per student —
// see curfewStatusesFromLogs below, which does that collapsing on the
// client for now.
//
// Approve/reject/assign/check-in update local state immediately
// (optimistic) so the workflow is testable right now, and best-effort
// mirror the change to Supabase in the background.

// Collapses raw curfew_logs rows (one per scan) into one current-status
// row per student, matching the shape the Overview/Curfew tabs expect.
// Replace this with a Supabase view/RPC once one exists — until then this
// keeps the warden side working against real curfew_logs rows instead of
// sample data.
function curfewStatusesFromLogs(logs, students) {
  const latestByStudent = new Map();
  for (const log of logs) {
    const existing = latestByStudent.get(log.student_id);
    if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
      latestByStudent.set(log.student_id, log);
    }
  }

  const studentsById = new Map(students.map((s) => [s.id, s]));

  return Array.from(latestByStudent.entries())
    .filter(([, log]) => log.scan_type === "check_out")
    .map(([studentId, log]) => {
      const student = studentsById.get(studentId);
      return {
        id: studentId,
        student_name: student?.full_name ?? "Unknown",
        room_number: student?.room_number ?? "—",
        check_out_time: new Date(log.timestamp).toTimeString().slice(0, 5),
        check_in_time: null,
        status: "out",
      };
    });
}

function WardenDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [curfewStatuses, setCurfewStatuses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [profile, setProfile] = useState(null);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  // Stats period lives here (not inside WardenOverviewTab) so the same
  // `analytics` object can also feed the floating AI Assistant widget,
  // which now renders once at the dashboard level, reachable from every tab.
  const [period, setPeriod] = useState("7");
  const periodDays = period === "all" ? null : Number(period);

  const analytics = useMemo(
    () => buildHostelAnalytics({ bookings, complaints, curfewStatuses, rooms, students, periodDays }),
    [bookings, complaints, curfewStatuses, rooms, students, periodDays]
  );

  const loadAll = async () => {
    setLoading(true);

    const [bookingsRes, complaintsRes, roomsRes, studentsRes, curfewRes, techniciansRes, profileRes, hostelsRes] =
      await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("complaints").select("*").order("created_at", { ascending: false }),
        supabase.from("rooms").select("*"),
        supabase.from("profiles").select("*").eq("role", "student"),
        supabase.from("curfew_logs").select("*").order("timestamp", { ascending: false }),
        supabase.from("profiles").select("id, full_name").eq("role", "technician"),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("hostels").select("*"),
      ]);

    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (complaintsRes.data) setComplaints(complaintsRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (studentsRes.data) setStudents(studentsRes.data);
    if (curfewRes.data && studentsRes.data) {
      setCurfewStatuses(curfewStatusesFromLogs(curfewRes.data, studentsRes.data));
    }
    if (techniciansRes.data) setTechnicians(techniciansRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setHostels(hostelsRes.data ?? []);

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

  // Assigns a specific technician (picked from the dropdown in
  // WardenComplaintsTab) and moves the complaint to "in_progress" in the
  // same update, so a complaint is never left in_progress unassigned.
  const handleAssign = (id, technicianId) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, assigned_technician: technicianId, status: "in_progress" } : c
      )
    );
    supabase
      .from("complaints")
      .update({ assigned_technician: technicianId, status: "in_progress" })
      .eq("id", id);
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
    supabase.from("curfew_logs").insert({
      student_id: id,
      scan_type: "check_in",
      timestamp: new Date().toISOString(),
    });
  };

  const renderTab = () => {
    switch (activeTab) {
      case "bookings":
        return <WardenBookingsTab bookings={bookings} onApprove={handleApprove} onReject={handleReject} />;
      case "complaints":
        return (
          <WardenComplaintsTab
            complaints={complaints}
            technicians={technicians}
            onAssign={handleAssign}
            onComplete={handleComplete}
          />
        );
      case "curfew":
        return <WardenCurfewTab curfewStatuses={curfewStatuses} onCheckIn={handleCheckIn} />;
      case "hostels":
        return (
          <WardenHostelsTab
            residences={mergeResidences(hostels)}
            rooms={rooms}
            onChanged={loadAll}
          />
        );
      case "profile":
        return <ProfileTab user={user} profile={profile} variant="staff" onSaved={setProfile} />;
      default:
        return (
          <WardenOverviewTab
            analytics={analytics}
            period={period}
            onPeriodChange={setPeriod}
            curfewStatuses={curfewStatuses}
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
        userName={profile?.full_name ?? user?.email ?? "Warden"}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? <p className="tab__empty">Loading warden dashboard&hellip;</p> : renderTab()}
      </main>

      {/* AI-assisted analytics per the proposal — a chat bubble the warden
          can open from any tab, rather than a panel fixed to Overview. */}
      {!loading && <HostelChatbot stats={analytics} />}
    </div>
  );
}

export default WardenDashboard;
