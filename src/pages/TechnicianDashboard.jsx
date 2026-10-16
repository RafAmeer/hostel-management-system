import { useEffect, useState } from "react";
import "../dashboard.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import TechnicianTasksTab from "../components/dashboard/TechnicianTasksTab";
import TechnicianHistoryTab from "../components/dashboard/TechnicianHistoryTab";
import ProfileTab from "../components/dashboard/ProfileTab";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";

const NAV_ITEMS = [
  { key: "tasks", label: "My Tasks", icon: "tasks" },
  { key: "history", label: "History", icon: "history" },
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
  const { toast, notify, dismiss } = useToast();

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

  // Both writes below are awaited and checked. Before, the remark was only
  // added to on-screen state and never sent to Supabase, so it vanished on
  // refresh (and the status update ignored failures). Now the screen keeps a
  // change only when the database accepted it; otherwise it rolls back and
  // says why.
  const handleAdvanceStatus = async (id) => {
    const task = tasks.find((t) => t.id === id);
    const next = task && STATUS_FLOW[task.status];
    if (!next) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: next } : t)));
    const { data, error } = await supabase
      .from("complaints")
      .update({ status: next })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error || !data) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: task.status } : t)));
      notify(error ? `Couldn't update the status: ${error.message}` : "The database didn't accept that change. Run the latest SQL migration.", "error");
      return;
    }
    notify(next === "completed" ? "Marked as completed." : "Work started.", "success");
  };

  const handleAddRemark = async (id, text) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return false;
    const stamp = new Date().toLocaleString("en-MY", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const previous = Array.isArray(task.remarks) ? task.remarks : [];
    const remarks = [...previous, `${stamp} · ${text}`];
    const { data, error } = await supabase
      .from("complaints")
      .update({ remarks })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error || !data) {
      notify(error ? `Couldn't save the remark: ${error.message}` : "The remark wasn't saved. Run the latest SQL migration.", "error");
      return false;
    }
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, remarks: data.remarks ?? remarks } : t)));
    notify("Remark saved.", "success");
    return true;
  };

  const renderTab = () => {
    if (activeTab === "history") return <TechnicianHistoryTab tasks={tasks} userId={user.id} />;
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
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

export default TechnicianDashboard;
