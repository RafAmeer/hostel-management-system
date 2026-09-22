import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import HostelSlideshow from "../components/HostelSlideshow.jsx";
import Sidebar from "../components/dashboard/SideBar.jsx";
import OverviewTab from "../components/dashboard/OverviewTab";
import RoomsTab from "../components/dashboard/RoomsTab";
import BookingsTab from "../components/dashboard/BookingsTab";
import ComplaintsTab from "../components/dashboard/ComplaintsTab";
import CurfewTab from "../components/dashboard/CurfewTab";
import ProfileTab from "../components/dashboard/ProfileTab";
import ProfileForm from "../components/dashboard/ProfileForm";
import { isStudentProfileComplete } from "../lib/studentProfile";

// NOTE: this assumes tables `profiles`, `rooms`, `bookings`, `complaints`,
// `curfew_logs` and `announcements` exist in Supabase (the announcements
// table and the extra profile columns come from
// supabase/migrations/2026-09-21_profile_announcements_assign.sql). All data
// below comes straight from those tables — no sample/mock data is shown, so
// an empty table means an empty (not fake) dashboard until real rows exist.

// Labels/keys match the "Home" wireframe's sidebar + Quick Access section.
// `icon` looks up a matching glyph in components/dashboard/icons.jsx.
const NAV_ITEMS = [
  { key: "overview", label: "Home", icon: "home" },
  { key: "rooms", label: "Rooms", icon: "rooms" },
  { key: "bookings", label: "Status", icon: "status" },
  { key: "complaints", label: "Complaint", icon: "complaint" },
  { key: "curfew", label: "Curfew", icon: "curfew" },
  { key: "profile", label: "Profile", icon: "profile" },
];

// PostgREST's "no rows" code — a brand-new account whose profile row hasn't
// been created yet is expected, not a load failure.
const NO_ROWS_CODE = "PGRST116";

function StudentDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [curfewLogs, setCurfewLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  const studentId = user?.id;

  const loadAll = async () => {
    setLoading(true);

    const [profileRes, roomsRes, bookingsRes, complaintsRes, curfewRes, announcementsRes] =
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
        // Pinned first, then newest. A missing table just means "no news".
        supabase
          .from("announcements")
          .select("*")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setProfileError("");
    } else if (profileRes.error && profileRes.error.code !== NO_ROWS_CODE) {
      setProfileError(profileRes.error.message);
    }
    if (roomsRes.data) setRooms(roomsRes.data);
    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (complaintsRes.data) setComplaints(complaintsRes.data);
    if (curfewRes.data) setCurfewLogs(curfewRes.data);
    if (announcementsRes.data) setAnnouncements(announcementsRes.data);

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
      case "profile":
        return (
          <ProfileTab
            user={user}
            profile={profile}
            variant="student"
            onSaved={setProfile}
          />
        );
      default:
        return (
          <OverviewTab
            profile={profile}
            bookings={bookings}
            complaints={complaints}
            curfewLogs={curfewLogs}
            announcements={announcements}
            onNavigate={setActiveTab}
          />
        );
    }
  };

  // First sign-in (or an older account with no name/ID saved): finish the
  // profile before showing the dashboard, so Home always has a name and ID.
  const needsProfileSetup = !loading && !profileError && !isStudentProfileComplete(profile);

  if (needsProfileSetup) {
    return (
      <div className="page">
        <HostelSlideshow />
        <div className="scrim" />
        <div className="container">
          <section className="card setup-card" aria-labelledby="setup-title">
            <h1 id="setup-title" className="title">
              Complete your profile
            </h1>
            <p className="subtitle">
              We need a few details before you can book a room or submit a complaint.
            </p>
            <ProfileForm
              user={user}
              profile={profile}
              variant="student"
              mode="setup"
              onSaved={setProfile}
            />
            <button type="button" className="portal-switch" onClick={onLogout}>
              Log out
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <HostelSlideshow />
      <div className="scrim" />

      <div className="dashboard">
        <Sidebar
          navItems={NAV_ITEMS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          userName={profile?.full_name ?? user?.email}
          onLogout={onLogout}
        />
        <main className="dashboard__content">
          {loading ? (
            <p className="tab__empty">Loading your dashboard…</p>
          ) : profileError ? (
            <div className="glass-panel placeholder-panel">
              <div>
                <p>Couldn't load your profile: {profileError}</p>
                <button type="button" className="primary-btn primary-btn--wide" onClick={loadAll}>
                  Try again
                </button>
              </div>
            </div>
          ) : (
            renderTab()
          )}
        </main>
      </div>
    </div>
  );
}

export default StudentDashboard;
