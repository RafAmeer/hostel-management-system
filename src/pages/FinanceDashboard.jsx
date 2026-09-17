import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import FinanceOverviewTab from "../components/dashboard/FinanceOverviewTab";
import PaymentsTab from "../components/dashboard/PaymentsTab";
import { MOCK_ALL_PAYMENTS } from "../lib/mockData";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "home" },
  { key: "payments", label: "Payments", icon: "payments" },
];

// New Finance Module per the proposal (view/record/update payment status,
// monitor outstanding vs completed, basic summary reports). This mirrors
// WardenDashboard's structure: mock data as a fallback until a real
// `payments` table + RLS policy for the finance role exist in Supabase.
function FinanceDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [payments, setPayments] = useState(MOCK_ALL_PAYMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("due_date", { ascending: true });
      if (data) setPayments(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleMarkPaid = (id) => {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "paid" } : p)));
    supabase.from("payments").update({ status: "paid" }).eq("id", id);
  };

  const renderTab = () => {
    if (activeTab === "payments") return <PaymentsTab payments={payments} onMarkPaid={handleMarkPaid} />;
    return <FinanceOverviewTab payments={payments} />;
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={user?.email ?? "Finance"}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? <p className="tab__empty">Loading finance dashboard&hellip;</p> : renderTab()}
      </main>
    </div>
  );
}

export default FinanceDashboard;
