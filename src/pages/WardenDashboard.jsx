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
import WardenAnnouncementsTab from "../components/dashboard/WardenAnnouncementsTab";
import StudentsTab from "../components/dashboard/StudentsTab";
import WardenTransportTab from "../components/dashboard/WardenTransportTab";
import WardenHelpTab from "../components/dashboard/WardenHelpTab";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "bookings", label: "Room Bookings", icon: "status" },
  { key: "students", label: "Students", icon: "students" },
  { key: "hostels", label: "Hostels & Rooms", icon: "rooms" },
  { key: "transport", label: "Transport", icon: "transport" },
  { key: "news", label: "News", icon: "news" },
  { key: "complaints", label: "Complaints", icon: "complaint" },
  { key: "curfew", label: "Curfew", icon: "curfew" },
  { key: "help", label: "Help Center", icon: "help" },
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
  const [announcements, setAnnouncements] = useState([]);
  const [curfewLogs, setCurfewLogs] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [transportError, setTransportError] = useState("");
  const [helpTickets, setHelpTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, notify, dismiss } = useToast();
  // Stats period lives here (not inside WardenOverviewTab) so the same
  // `analytics` object can also feed the floating AI Assistant widget,
  // which now renders once at the dashboard level, reachable from every tab.
  const [period, setPeriod] = useState("7");
  const periodDays = period === "all" ? null : Number(period);

  const analytics = useMemo(
    () => buildHostelAnalytics({ bookings, complaints, curfewStatuses, rooms, students, periodDays }),
    [bookings, complaints, curfewStatuses, rooms, students, periodDays]
  );

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setAnnouncements(data ?? []);
  };

  // Timetable edits only need this table refreshed, not the whole dashboard.
  const loadTransport = async () => {
    const res = await supabase.from("transport_schedule").select("*").order("departure_time");
    if (res.error) {
      setTransportError(res.error.message);
      return;
    }
    setTransportError("");
    setSchedule(res.data ?? []);
  };

  const loadHelp = async () => {
    const res = await supabase.from("help_tickets").select("*").order("updated_at", { ascending: false });
    if (res.data) setHelpTickets(res.data);
  };

  const loadAll = async () => {
    setLoading(true);

    const [
      bookingsRes,
      complaintsRes,
      roomsRes,
      studentsRes,
      curfewRes,
      techniciansRes,
      profileRes,
      hostelsRes,
      scheduleRes,
      helpRes,
    ] =
      await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("complaints").select("*").order("created_at", { ascending: false }),
        supabase.from("rooms").select("*"),
        supabase.from("profiles").select("*").eq("role", "student"),
        supabase.from("curfew_logs").select("*").order("timestamp", { ascending: false }),
        supabase.from("profiles").select("id, full_name").eq("role", "technician"),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("hostels").select("*"),
        supabase.from("transport_schedule").select("*").order("departure_time"),
        supabase.from("help_tickets").select("*").order("updated_at", { ascending: false }),
      ]);

    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (complaintsRes.data) setComplaints(complaintsRes.data);
    if (roomsRes.data) setRooms(roomsRes.data);
    if (studentsRes.data) setStudents(studentsRes.data);
    if (curfewRes.data) setCurfewLogs(curfewRes.data);
    if (scheduleRes.error) {
      setTransportError(scheduleRes.error.message);
    } else {
      setTransportError("");
      setSchedule(scheduleRes.data ?? []);
    }
    if (helpRes.data) setHelpTickets(helpRes.data);
    if (curfewRes.data && studentsRes.data) {
      setCurfewStatuses(curfewStatusesFromLogs(curfewRes.data, studentsRes.data));
    }
    if (techniciansRes.data) setTechnicians(techniciansRes.data);
    if (profileRes.data) setProfile(profileRes.data);
    setHostels(hostelsRes.data ?? []);
    await loadAnnouncements();

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // New student help requests show up without a manual refresh.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") loadHelp();
    }, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every write below is awaited and its error checked. Before, the update
  // was fire-and-forget: if the database refused it (e.g. no warden UPDATE
  // policy), the warden's screen still flipped to "approved" while the row
  // stayed "pending" — so the student never saw the change. Now the screen
  // only keeps the new status when the database actually accepted it.
  const decideBooking = async (id, status) => {
    const previous = bookings.find((b) => b.id === id);
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));

    const { data, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error || !data) {
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: previous?.status ?? "pending" } : b)));
      notify(
        error
          ? `Couldn't ${status === "approved" ? "approve" : "reject"} the booking: ${error.message}`
          : "The database didn't accept that change. Run the latest SQL migration (warden booking policy).",
        "error"
      );
      return;
    }

    // Approved: the student now lives in that room, so keep their profile in
    // step (this is what fixes "Not in hostel" showing after approval).
    if (status === "approved") {
      const patch = { in_hostel: true, room_number: data.room_number ?? previous?.room_number ?? null };
      const { error: profileError } = await supabase.from("profiles").update(patch).eq("id", data.student_id);
      if (!profileError) {
        setStudents((prev) => prev.map((s) => (s.id === data.student_id ? { ...s, ...patch } : s)));
      }
    }
    notify(status === "approved" ? "Booking approved. The student can see it now." : "Booking rejected.", "success");
  };

  const handleApprove = (id) => decideBooking(id, "approved");
  const handleReject = (id) => decideBooking(id, "rejected");

  // Warden eligibility override (Students tab). `status` is "eligible",
  // "not_eligible", or null to hand the decision back to the automatic rule.
  const handleEligibilityChange = async (studentId, status) => {
    const patch = status
      ? { eligibility_status: status, eligibility_override: true }
      : { eligibility_override: false };
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", studentId)
      .select()
      .maybeSingle();
    if (error || !data) {
      notify(error ? `Couldn't update eligibility: ${error.message}` : "Eligibility change wasn't saved (check the SQL migration).", "error");
      return;
    }
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, ...data } : s)));
    notify("Eligibility updated.", "success");
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
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          notify(`Couldn't assign the technician: ${error.message}`, "error");
          loadAll();
        }
      });
  };

  const handleComplete = (id) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: "completed" } : c)));
    supabase
      .from("complaints")
      .update({ status: "completed" })
      .eq("id", id)
      .then(({ error }) => {
        if (error) {
          notify(`Couldn't mark it completed: ${error.message}`, "error");
          loadAll();
        }
      });
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

  const waitingHelp = helpTickets.filter((t) => t.status === "open").length;
  const navItems = NAV_ITEMS.map((i) => (i.key === "help" ? { ...i, badge: waitingHelp } : i));

  const renderTab = () => {
    switch (activeTab) {
      case "bookings":
        return <WardenBookingsTab bookings={bookings} onApprove={handleApprove} onReject={handleReject} />;
      case "students":
        return (
          <StudentsTab
            students={students}
            bookings={bookings}
            onEligibilityChange={handleEligibilityChange}
          />
        );
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
        return (
          <WardenCurfewTab
            curfewStatuses={curfewStatuses}
            onCheckIn={handleCheckIn}
            residences={mergeResidences(hostels)}
          />
        );
      case "help":
        return <WardenHelpTab tickets={helpTickets} students={students} onChanged={loadHelp} />;
      case "transport":
        return (
          <WardenTransportTab
            schedule={schedule}
            residences={mergeResidences(hostels)}
            loadError={transportError}
            onChanged={loadTransport}
            notify={notify}
          />
        );
      case "hostels":
        return (
          <WardenHostelsTab
            residences={mergeResidences(hostels)}
            rooms={rooms}
            onChanged={loadAll}
          />
        );
      case "news":
        return (
          <WardenAnnouncementsTab
            announcements={announcements}
            onChanged={loadAnnouncements}
            notify={notify}
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
            bookings={bookings}
            complaints={complaints}
            rooms={rooms}
            students={students}
            curfewLogs={curfewLogs}
            residences={mergeResidences(hostels)}
          />
        );
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={navItems}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={profile?.full_name ?? user?.email ?? "Warden"}
        roleLabel="Warden"
        avatarUrl={profile?.avatar_url}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? (
          <p className="tab__empty">Loading warden dashboard&hellip;</p>
        ) : (
          <div key={activeTab} className="tab-fade">
            {renderTab()}
          </div>
        )}
      </main>
      <Toast toast={toast} onDismiss={dismiss} />

      {/* AI-assisted analytics per the proposal — a chat bubble the warden
          can open from any tab, rather than a panel fixed to Overview. */}
      {!loading && <HostelChatbot stats={analytics} />}
    </div>
  );
}

export default WardenDashboard;
