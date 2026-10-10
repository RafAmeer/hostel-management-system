import { useEffect, useRef, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import OverviewTab from "../components/dashboard/OverviewTab";
import RoomsTab from "../components/dashboard/RoomsTab";
import BookingsTab from "../components/dashboard/BookingsTab";
import ComplaintsTab from "../components/dashboard/ComplaintsTab";
import CurfewTab from "../components/dashboard/CurfewTab";
import TransportTab from "../components/dashboard/TransportTab";
import ProfileTab from "../components/dashboard/ProfileTab";
import ProfileForm from "../components/dashboard/ProfileForm";
import { isStudentProfileComplete } from "../lib/studentProfile";
import { mergeResidences } from "../lib/residences";
import Toast from "../components/Toast.jsx";
import { useToast } from "../hooks/useToast";

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
  { key: "transport", label: "Transport", icon: "transport" },
  { key: "curfew", label: "Curfew", icon: "curfew" },
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
  const [residences, setResidences] = useState(mergeResidences([]));
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [transportRequests, setTransportRequests] = useState([]);
  const [transportLoads, setTransportLoads] = useState([]);
  const [transportError, setTransportError] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast, notify, dismiss } = useToast(5000);
  // Last status seen for each booking, so a change made by the warden can be
  // announced ("Your booking was approved") the moment it shows up.
  const bookingStatuses = useRef(null);

  const studentId = user?.id;

  // `silent` refreshes in the background (realtime / polling) without
  // flashing the "Loading…" state over whatever the student is reading.
  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);

    const [
      profileRes,
      roomsRes,
      bookingsRes,
      complaintsRes,
      curfewRes,
      announcementsRes,
      hostelsRes,
      routesRes,
      requestsRes,
      loadsRes,
    ] =
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
        // Warden-added hostels merge on top of the starter placeholder list
        // (mergeResidences) — a missing/empty table just means "no
        // warden-added hostels yet", not an error.
        supabase.from("hostels").select("*"),
        // Transport (campus shuttle for off-campus hostels). A missing
        // table just means the migration hasn't been run yet.
        supabase.from("transport_routes").select("*").order("name"),
        supabase
          .from("transport_requests")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase.from("transport_route_load").select("*"),
      ]);

    if (profileRes.data) {
      setProfile(profileRes.data);
      setProfileError("");
    } else if (profileRes.error && profileRes.error.code !== NO_ROWS_CODE) {
      setProfileError(profileRes.error.message);
    }
    if (roomsRes.data) setRooms(roomsRes.data);
    if (bookingsRes.data) {
      const previous = bookingStatuses.current;
      if (previous) {
        bookingsRes.data.forEach((b) => {
          const before = previous[b.id];
          if (before && before !== b.status) {
            const room = b.room_number ? `Room ${b.room_number}` : "Your room";
            if (b.status === "approved") notify(`${room} booking was approved.`, "success");
            else if (b.status === "rejected") notify(`${room} booking was rejected.`, "error");
            else if (b.status === "cancelled") notify(`${room} booking was cancelled.`, "info");
          }
        });
      }
      bookingStatuses.current = Object.fromEntries(bookingsRes.data.map((b) => [b.id, b.status]));
      setBookings(bookingsRes.data);
    }
    if (complaintsRes.data) setComplaints(complaintsRes.data);
    if (curfewRes.data) setCurfewLogs(curfewRes.data);
    if (announcementsRes.data) setAnnouncements(announcementsRes.data);
    setResidences(mergeResidences(hostelsRes.data));
    if (routesRes.error) {
      setTransportError(routesRes.error.message);
    } else {
      setTransportError("");
      setTransportRoutes(routesRes.data ?? []);
      setTransportRequests(requestsRes.data ?? []);
      setTransportLoads(loadsRes.data ?? []);
    }

    if (!silent) setLoading(false);
  };

  useEffect(() => {
    if (studentId) loadAll();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Keep the student's side in step with what the warden decides. Three
  // layers so it works even if one is unavailable: a Supabase realtime
  // subscription to this student's bookings (instant), a refresh whenever
  // the tab/app comes back into view, and a slow background poll.
  useEffect(() => {
    if (!studentId) return undefined;
    const refresh = () => loadAll(true);

    const channel = supabase
      .channel(`student-bookings-${studentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `student_id=eq.${studentId}` },
        refresh
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(refresh, 20000);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const renderTab = () => {
    switch (activeTab) {
      case "rooms":
        return (
          <RoomsTab
            rooms={rooms}
            residences={residences}
            bookings={bookings}
            studentId={studentId}
            studentGender={profile?.gender}
            semester={profile?.semester}
            eligibility={profile?.eligibility_status}
            onBookingCreated={() => loadAll(true)}
          />
        );
      case "bookings":
        return <BookingsTab bookings={bookings} />;
      case "complaints":
        return (
          <ComplaintsTab
            complaints={complaints}
            studentId={studentId}
            residences={residences}
            defaultRoomNumber={profile?.room_number}
            onComplaintCreated={() => loadAll(true)}
          />
        );
      case "transport":
        return (
          <TransportTab
            routes={transportRoutes}
            requests={transportRequests}
            loads={transportLoads}
            bookings={bookings}
            rooms={rooms}
            residences={residences}
            studentId={studentId}
            loadError={transportError}
            onChanged={() => loadAll(true)}
          />
        );
      case "curfew":
        return (
          <CurfewTab curfewLogs={curfewLogs} userId={studentId} />
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
      <div className="page page--app">
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

  // After sign-in the dashboard sits on a plain white/black background
  // (by theme) — the photo slideshow is only for the sign-in/sign-up pages.
  return (
    <div className="page page--app">
      <div className="dashboard">
        <Sidebar
          navItems={NAV_ITEMS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          userName={profile?.full_name ?? user?.email}
          avatarUrl={profile?.avatar_url}
          onLogout={onLogout}
          onProfile={() => setActiveTab("profile")}
        />
        <main className="dashboard__content">
          {loading ? (
            <p className="tab__empty">Loading your dashboard…</p>
          ) : profileError ? (
            <div className="glass-panel placeholder-panel">
              <div>
                <p>Couldn't load your profile: {profileError}</p>
                <button type="button" className="primary-btn primary-btn--wide" onClick={() => loadAll()}>
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <div key={activeTab} className="tab-fade">
              {renderTab()}
            </div>
          )}
        </main>
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

export default StudentDashboard;
