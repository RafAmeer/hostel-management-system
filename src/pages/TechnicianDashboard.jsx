import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import TechnicianTasksTab from "../components/dashboard/TechnicianTasksTab";
import TechnicianHistoryTab from "../components/dashboard/TechnicianHistoryTab";
import { MOCK_ALL_MAINTENANCE } from "../lib/mockData";

const NAV_ITEMS = [
  { key: "tasks", label: "My Tasks", icon: "tasks" },
  { key: "history", label: "History", icon: "history" },
];

const STATUS_FLOW = { pending: "in_progress", in_progress: "completed" };

// New Technician Module per the proposal (view assigned maintenance
// requests, update status, add remarks, view history). Same mock-data
// fallback pattern as the other dashboards until `complaints` has an
// `assigned_technician` column + RLS policy for the technician role.
function TechnicianDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("tasks");
  const [tasks, setTasks] = useState(MOCK_ALL_MAINTENANCE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setTasks(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleAdvanceStatus = (id) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id && STATUS_FLOW[t.status] ? { ...t, status: STATUS_FLOW[t.status] } : t))
    );
    const next = tasks.find((t) => t.id === id) && STATUS_FLOW[tasks.find((t) => t.id === id).status];
    if (next) supabase.from("complaints").update({ status: next }).eq("id", id);
  };

  const handleAddRemark = (id, text) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, remarks: [...(t.remarks ?? []), text] } : t))
    );
  };

  const renderTab = () => {
    if (activeTab === "history") return <TechnicianHistoryTab tasks={tasks} />;
    return <TechnicianTasksTab tasks={tasks} onAdvanceStatus={handleAdvanceStatus} onAddRemark={handleAddRemark} />;
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={user?.email ?? "Technician"}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? <p className="tab__empty">Loading technician dashboard&hellip;</p> : renderTab()}
      </main>
    </div>
  );
}

export default TechnicianDashboard;
