import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import FinanceOverviewTab from "../components/dashboard/FinanceOverviewTab";
import PaymentsTab from "../components/dashboard/PaymentsTab";
import ProfileTab from "../components/dashboard/ProfileTab";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "payments", label: "Payments", icon: "payments" },
  { key: "profile", label: "Profile", icon: "profile" },
];

// Finance Module per the proposal (view/record/update payment status,
// monitor outstanding vs completed, basic summary reports). Reads straight
// from the real `payments` table — an empty table just means no rows yet.
function FinanceDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [payments, setPayments] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [paymentsRes, profileRes] = await Promise.all([
        supabase.from("payments").select("*").order("due_date", { ascending: true }),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      if (paymentsRes.data) setPayments(paymentsRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    };
    load();
  }, [user.id]);

  const handleMarkPaid = (id) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "paid" } : p)));
    supabase.from("payments").update({ status: "paid" }).eq("id", id);
  };

  const renderTab = () => {
    if (activeTab === "payments") return <PaymentsTab payments={payments} onMarkPaid={handleMarkPaid} />;
    if (activeTab === "profile") return <ProfileTab user={user} profile={profile} variant="staff" onSaved={setProfile} />;
    return <FinanceOverviewTab payments={payments} />;
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={profile?.full_name ?? user?.email ?? "Finance"}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? (
          <p className="tab__empty">Loading finance dashboard&hellip;</p>
        ) : (
          <div key={activeTab} className="tab-fade">
            {renderTab()}
          </div>
        )}
      </main>
    </div>
  );
}

export default FinanceDashboard;
