import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import TechnicianTasksTab from "../components/dashboard/TechnicianTasksTab";
import TechnicianHistoryTab from "../components/dashboard/TechnicianHistoryTab";
import ProfileTab from "../components/dashboard/ProfileTab";

const NAV_ITEMS = [
  { key: "tasks", label: "My Tasks", icon: "tasks" },
  { key: "history", label: "History", icon: "history" },
  { key: "profile", label: "Profile", icon: "profile" },
];

const STATUS_FLOW = { pending: "in_progress", in_progress: "completed" };

// Technician Module per the proposal (view assigned maintenance requests,
// update status, add remarks, view history). Reads straight from the real
// `complaints` table, filtered to the requests the Warden assigned to this
// technician (assigned_technician = this user's id).
function TechnicianDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("tasks");
  const [tasks, setTasks] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [tasksRes, profileRes] = await Promise.all([
        supabase
          .from("complaints")
          .select("*")
          .eq("assigned_technician", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      if (tasksRes.data) setTasks(tasksRes.data);
      if (profileRes.data) setProfile(profileRes.data);
      setLoading(false);
    };
    if (user?.id) load();
    else setLoading(false);
  }, [user?.id]);

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
    if (activeTab === "profile") return <ProfileTab user={user} profile={profile} variant="staff" onSaved={setProfile} />;
    return <TechnicianTasksTab tasks={tasks} onAdvanceStatus={handleAdvanceStatus} onAddRemark={handleAddRemark} />;
  };

  return (
    <div className="dashboard">
      <Sidebar
        navItems={NAV_ITEMS}
        activeTab={activeTab}
        onSelect={setActiveTab}
        userName={profile?.full_name ?? user?.email ?? "Technician"}
        roleLabel="Technician"
        avatarUrl={profile?.avatar_url}
        onLogout={onLogout}
      />
      <main className="dashboard__content">
        {loading ? (
          <p className="tab__empty">Loading technician dashboard&hellip;</p>
        ) : (
          <div key={activeTab} className="tab-fade">
            {renderTab()}
          </div>
        )}
      </main>
    </div>
  );
}

export default TechnicianDashboard;
