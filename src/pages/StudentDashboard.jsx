import { useEffect, useMemo, useRef, useState } from "react";
import "../dashboard.css";
import "../student-theme.css";
import "../feedback-updates.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import OverviewTab from "../components/dashboard/OverviewTab";
import RoomsTab from "../components/dashboard/RoomsTab";
import BookingsTab from "../components/dashboard/BookingsTab";
import ComplaintsTab from "../components/dashboard/ComplaintsTab";
import CurfewTab from "../components/dashboard/CurfewTab";
import TransportTab from "../components/dashboard/TransportTab";
import HelpTab from "../components/dashboard/HelpTab";
import ProfileTab from "../components/dashboard/ProfileTab";
import ProfileForm from "../components/dashboard/ProfileForm";
import { isStudentProfileComplete } from "../lib/studentProfile";
import { mergeResidences } from "../lib/residences";
import Toast from "../components/Toast.jsx";
import { useToast } from "../hooks/useToast";
import NotificationBell from "../components/dashboard/NotificationBell";
import { useNotifications } from "../hooks/useNotifications";
import { buildStudentNotifications } from "../lib/notifications";
import WelcomeTour from "../components/dashboard/WelcomeTour";
import HostelSlideshow from "../components/HostelSlideshow.jsx";

// NOTE: this assumes tables `profiles`, `rooms`, `bookings`, `complaints`,
// `curfew_logs` and `announcements` exist in Supabase (the announcements
// table and the extra profile columns come from
// supabase/migrations/2026-09-21_profile_announcements_assign.sql). All data
// below comes straight from those tables — no sample/mock data is shown, so
// an empty table means an empty (not fake) dashboard until real rows exist.

// Labels/keys match the "Home" wireframe's sidebar + Quick Access section.
// `icon` looks up a matching glyph in components/dashboard/icons.jsx.
// `mobileHidden` items stay in the desktop sidebar but are left out of the
// phone's bottom bar so it fits on one row (Home, Rooms, Complaint, Curfew).
// On phones they're reached from the status cards on Home instead.
const NAV_ITEMS = [
  { key: "overview", label: "Home", icon: "home" },
  { key: "rooms", label: "Rooms", icon: "rooms" },
  { key: "bookings", label: "Status", icon: "status", mobileHidden: true },
  { key: "complaints", label: "Complaint", icon: "complaint" },
  { key: "transport", label: "Transport", icon: "transport", mobileHidden: true },
  { key: "curfew", label: "Curfew", icon: "curfew" },
  { key: "help", label: "Help", icon: "help", mobileHidden: true },
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
  const [schedule, setSchedule] = useState([]);
  const [transportError, setTransportError] = useState("");
  const [helpTickets, setHelpTickets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast, notify, dismiss } = useToast(5000);
  // Last status seen for each booking, so a change made by the warden can be
  // announced ("Your booking was approved") the moment it shows up.
  const bookingStatuses = useRef(null);
  const helpStatuses = useRef(null);
  const financeStatusRef = useRef(null);

  const studentId = user?.id;

  const notifItems = useMemo(
    () => buildStudentNotifications({ bookings, complaints, helpTickets, announcements, profile, payments }),
    [bookings, complaints, helpTickets, announcements, profile, payments]
  );
  const notif = useNotifications(studentId, notifItems, { ready: !loading });

  // Turns on the playful student theme (src/student-theme.css) while the
  // student dashboard is on screen. It sits on <html> so popups rendered
  // into <body> (hostel details, toasts) get the same look; it's removed on
  // log out so the sign-in page and staff dashboards are untouched.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("student-fun");
    return () => root.classList.remove("student-fun");
  }, []);

  // `silent` refreshes in the background (realtime / polling) without
  // flashing the "Loading…" state over whatever the student is reading.
  const loadAll = async (silent = false) => {
    if (!silent) setLoading(true);
    // Re-run the automatic eligibility check (at most once a day, see
    // 2026-11-09_eligibility_rules.sql) so an overdue payment is picked up.
    // Errors are ignored: the dashboard still loads without it.
    if (!silent) await supabase.rpc("refresh_eligibility");

    const [
      profileRes,
      roomsRes,
      bookingsRes,
      complaintsRes,
      curfewRes,
      announcementsRes,
      hostelsRes,
      scheduleRes,
      helpRes,
      paymentsRes,
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
        // Fixed shuttle timetable the warden maintains. A missing table
        // just means the migration hasn't been run yet.
        supabase.from("transport_schedule").select("*").eq("active", true).order("departure_time"),
        // This student's help requests to the warden.
        supabase
          .from("help_tickets")
          .select("*")
          .eq("student_id", studentId)
          .order("updated_at", { ascending: false }),
        // Hostel fees owed (payments RLS only returns this student's rows).
        supabase
          .from("payments")
          .select("*")
          .eq("student_id", studentId)
          .order("due_date", { ascending: true }),
      ]);

    if (profileRes.data) {
      const before = financeStatusRef.current;
      const after = profileRes.data.finance_status;
      if (before && after && before !== after) {
        if (after === "verified") notify("Finance verified your account. You can book a room now!", "success");
        else if (after === "rejected") notify("Finance couldn't verify your account. See Home for details.", "error");
      }
      financeStatusRef.current = after;
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
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (curfewRes.data) setCurfewLogs(curfewRes.data);
    if (announcementsRes.data) setAnnouncements(announcementsRes.data);
    setResidences(mergeResidences(hostelsRes.data));
    if (scheduleRes.error) {
      setTransportError(scheduleRes.error.message);
    } else {
      setTransportError("");
      setSchedule(scheduleRes.data ?? []);
    }
    if (helpRes.data) {
      const previous = helpStatuses.current;
      if (previous) {
        helpRes.data.forEach((t) => {
          if (previous[t.id] && previous[t.id] !== "answered" && t.status === "answered") {
            notify(`The warden replied to "${t.subject}".`, "info");
          }
        });
      }
      helpStatuses.current = Object.fromEntries(helpRes.data.map((t) => [t.id, t.status]));
      setHelpTickets(helpRes.data);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `student_id=eq.${studentId}` },
        refresh
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, refresh)
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
            eligibilityReason={profile?.eligibility_override ? profile?.eligibility_note : profile?.eligibility_reason}
            financeStatus={profile?.finance_status ?? "pending"}
            financeNote={profile?.finance_note}
            onBookingCreated={() => loadAll(true)}
          />
        );
      case "bookings":
        return <BookingsTab bookings={bookings} userId={studentId} />;
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
            schedule={schedule}
            bookings={bookings}
            rooms={rooms}
            residences={residences}
            loadError={transportError}
          />
        );
      case "help":
        return <HelpTab tickets={helpTickets} studentId={studentId} onChanged={() => loadAll(true)} />;
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
            helpTickets={helpTickets}
            rooms={rooms}
            residences={residences}
            schedule={schedule}
            transportError={transportError}
            payments={payments}
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
        <div className="student-backdrop" aria-hidden="true">
          <HostelSlideshow />
          <div className="student-backdrop__shade" />
        </div>
        <div className="container">
          <section className="card setup-card" aria-labelledby="setup-title">
            <h1 id="setup-title" className="title">
              Welcome to DormSphere! 👋
            </h1>
            <p className="subtitle">
              Tell us a bit about yourself first, then you can book a room, report problems and more.
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

  // Like the first design: blurred hostel photos behind see-through panels
  // (styles at the end of student-theme.css).
  return (
    <div className="page page--app">
      <div className="student-backdrop" aria-hidden="true">
        <HostelSlideshow />
        <div className="student-backdrop__shade" />
      </div>
      <div className="dashboard">
        <Sidebar
          navItems={NAV_ITEMS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          userName={profile?.full_name ?? user?.email}
          avatarUrl={profile?.avatar_url}
          onLogout={onLogout}
          onProfile={() => setActiveTab("profile")}
          bell={<NotificationBell notif={notif} onNavigate={setActiveTab} />}
        />
        <main className="dashboard__content">
          {loading ? (
            <p className="tab__empty">Getting your dashboard ready…</p>
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
            <div key={activeTab} className="tab-fade" data-tab={activeTab}>
              {renderTab()}
            </div>
          )}
        </main>
      </div>
      {!loading && !profileError && (
        <WelcomeTour
          userId={studentId}
          firstName={(profile?.full_name ?? "there").split(" ")[0]}
          onNavigate={setActiveTab}
        />
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

export default StudentDashboard;
