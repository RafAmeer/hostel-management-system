import { useEffect, useState } from "react";
import "../dashboard.css";
import "../feedback-updates.css";
import { supabase } from "../lib/supabaseClient.js";
import Sidebar from "../components/dashboard/SideBar.jsx";
import FinanceOverviewTab from "../components/dashboard/FinanceOverviewTab";
import FinanceVerifyTab from "../components/dashboard/FinanceVerifyTab";
import PaymentsTab from "../components/dashboard/PaymentsTab";
import ProfileTab from "../components/dashboard/ProfileTab";
import Toast from "../components/Toast";
import { useToast } from "../hooks/useToast";
import { balanceOf, money } from "../lib/payments";

// Finance Module per the proposal (view/record/update payment status,
// monitor outstanding vs completed, basic summary reports), plus verifying
// new student accounts before they can book a room.
function FinanceDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast, notify, dismiss } = useToast();

  const loadPayments = async () => {
    const { data } = await supabase.from("payments").select("*").order("due_date", { ascending: true });
    if (data) setPayments(data);
  };

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
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => loadPayments())
      .subscribe();
    const poll = setInterval(loadStudents, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Records money received against one charge. Partial payments keep the
  // row "outstanding" with a smaller balance; paying the rest marks it paid.
  const handleRecordPayment = async (row, amount) => {
    const paidSoFar = Number(row.amount_paid ?? 0) + Number(amount);
    const settled = paidSoFar >= Number(row.amount) - 0.001;
    const patch = {
      amount_paid: Math.min(Number(row.amount), Math.round(paidSoFar * 100) / 100),
      status: settled ? "paid" : row.status === "overdue" ? "overdue" : "outstanding",
      paid_at: settled ? new Date().toISOString() : row.paid_at ?? null,
    };
    const { data, error } = await supabase.from("payments").update(patch).eq("id", row.id).select().maybeSingle();
    if (error || !data) {
      notify(error ? `Couldn't record the payment: ${error.message}` : "The payment wasn't saved. Run the latest SQL migration.", "error");
      return false;
    }
    setPayments((prev) => prev.map((p) => (p.id === row.id ? data : p)));
    notify(settled ? `${row.student_name}'s charge is now fully paid.` : `${money(amount)} recorded. ${money(balanceOf(data))} still outstanding.`, "success");
    return true;
  };

  // Stamps reminder_sent_at on every unpaid row for that student. The
  // student's Home page and notification bell pick it up.
  const handleSendReminder = async (owing) => {
    const ids = owing.records.map((p) => p.id);
    const stamp = new Date().toISOString();
    const { data, error } = await supabase.from("payments").update({ reminder_sent_at: stamp }).in("id", ids).select();
    if (error || !data?.length) {
      notify(error ? `Couldn't send the reminder: ${error.message}` : "The reminder wasn't saved. Run the latest SQL migration.", "error");
      return;
    }
    setPayments((prev) => prev.map((p) => data.find((d) => d.id === p.id) ?? p));
    notify(`Reminder sent to ${owing.student_name} (${money(owing.balance)} outstanding).`, "success");
  };

  const handleCreateCharge = async (fields) => {
    const { data, error } = await supabase
      .from("payments")
      .insert({ ...fields, amount_paid: 0, status: "outstanding" })
      .select()
      .maybeSingle();
    if (error || !data) {
      notify(error ? `Couldn't add the charge: ${error.message}` : "The charge wasn't saved.", "error");
      return false;
    }
    setPayments((prev) => [...prev, data].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))));
    notify(`Charge of ${money(fields.amount)} added for ${fields.student_name}.`, "success");
    return true;
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
    if (activeTab === "payments")
      return (
        <PaymentsTab
          payments={payments}
          students={students}
          onRecordPayment={handleRecordPayment}
          onSendReminder={handleSendReminder}
          onCreateCharge={handleCreateCharge}
        />
      );
    if (activeTab === "profile") return <ProfileTab user={user} profile={profile} variant="staff" onSaved={setProfile} />;
    return <FinanceOverviewTab payments={payments} onNavigate={setActiveTab} />;
  };

  return (
    <div className="dashboard dashboard--staff">
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
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}

export default FinanceDashboard;
