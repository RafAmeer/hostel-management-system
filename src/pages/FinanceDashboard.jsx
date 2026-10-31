import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import FinanceOverviewTab from "../components/dashboard/FinanceOverviewTab";
import FinanceVerifyTab from "../components/dashboard/FinanceVerifyTab";
import PaymentsTab from "../components/dashboard/PaymentsTab";
import ProfileTab from "../components/dashboard/ProfileTab";

// Finance Module per the proposal (view/record/update payment status,
// monitor outstanding vs completed, basic summary reports), plus verifying
// new student accounts before they can book a room.
function FinanceDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStudents = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "student")
      .order("created_at", { ascending: false });
    if (data) setStudents(data);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [paymentsRes, profileRes] = await Promise.all([
        supabase.from("payments").select("*").order("due_date", { ascending: true }),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        loadStudents(),
      ]);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    };
    load();

    // New sign-ups appear without a refresh.
    const channel = supabase
      .channel("finance-profiles")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadStudents())
      .subscribe();
    const poll = setInterval(loadStudents, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const handleMarkPaid = (id) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "paid" } : p)));
    supabase.from("payments").update({ status: "paid" }).eq("id", id);
  };

  // Goes through the finance_verify_student() database function — students
  // and wardens can't change this column themselves.
  const handleDecide = async (studentId, status, note) => {
    const { error } = await supabase.rpc("finance_verify_student", {
      p_student: studentId,
      p_status: status,
      p_note: note || null,
    });
    if (error) throw new Error(error.message);
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              finance_status: status,
              finance_note: status === "pending" ? null : note || null,
              finance_verified_at: status === "pending" ? null : new Date().toISOString(),
            }
          : s
      )
    );
  };

  const waiting = students.filter((s) => (s.finance_status ?? "pending") === "pending").length;

  const navItems = [
    { key: "overview", label: "Overview", icon: "home" },
    { key: "verify", label: waiting ? `Verify Students (${waiting})` : "Verify Students", icon: "students" },
    { key: "payments", label: "Payments", icon: "payments" },
  ];

  const renderTab = () => {
    if (activeTab === "verify")
      return <FinanceVerifyTab students={students} payments={payments} onDecide={handleDecide} />;
    if (activeTab === "payments") return <PaymentsTab payments={payments} onMarkPaid={handleMarkPaid} />;
    if (activeTab === "profile") return <ProfileTab user={user} profile={profile} variant="staff" onSaved={setProfile} />;
    return <FinanceOverviewTab payments={payments} />;
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={navItems}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={profile?.full_name ?? user?.email ?? "Finance"}
        roleLabel="Finance"
        avatarUrl={profile?.avatar_url}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? (
          <p className="tab__empty">Loading finance dashboard&hellip;</p>
        ) : (
          <div key={activeTab} className="tab-fade">
            {waiting > 0 && activeTab === "overview" && (
              <div className="finance-notice" role="status">
                <div>
                  <p className="finance-notice__title">
                    {waiting} new student{waiting === 1 ? "" : "s"} waiting for verification
                  </p>
                  <p className="finance-notice__text">
                    They can't book a room until you verify them.{" "}
                    <button type="button" className="link-btn" onClick={() => setActiveTab("verify")}>
                      Review now
                    </button>
                  </p>
                </div>
              </div>
            )}
            {renderTab()}
          </div>
        )}
      </main>
    </div>
  );
}

export default FinanceDashboard;
