import { useEffect, useState } from "react";
import "./index.css";
import { supabase } from "./lib/supabaseClient";
import HostelSlideshow from "./components/HostelSlideshow";
import StudentDashboard from "./pages/StudentDashboard";
import WardenDashboard from "./pages/WardenDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import TechnicianDashboard from "./pages/TechnicianDashboard";

// Warden, Finance and Technician all share one "Staff" sign-in page now
// (previously each had — or would have needed — its own login form).
// Which dashboard renders after signing in is decided purely by the
// `role` column, not by which login form was used.
const STAFF_ROLES = ["warden", "finance", "technician"];

const REMEMBERED_EMAIL_KEY = "hostel_remembered_email";

// Reads the signed-in user's role from `profiles`. Assumes a `role` text
// column on `profiles` with values "student" | "warden" | "finance" |
// "technician" — run this once in the Supabase SQL editor if it isn't
// there yet:
//   alter table profiles add column if not exists role text not null default 'student';
// Missing column/row (e.g. older accounts) falls back to "student" so
// existing student logins keep working.
async function fetchRole(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return data?.role ?? "student";
}

function App() {
  // Which login screen is showing when signed out — no longer a dashboard
  // toggle, just which form the person sees before they've authenticated.
  const [portal, setPortal] = useState("student"); // "student" | "staff"
  const [mode, setMode] = useState("login"); // "login" | "signup" (student portal only)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Load a remembered email on first render
  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  // Keep session + role in sync, including on refresh/passive session
  // restore (not just the explicit login button below).
  useEffect(() => {
    const syncFromSession = async (session) => {
      if (session?.user) {
        const r = await fetchRole(session.user.id);
        setUser(session.user);
        setRole(r);
      } else {
        setUser(null);
        setRole(null);
      }
    };

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await syncFromSession(session);
      setCheckingSession(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const switchPortal = (nextPortal) => {
    resetMessages();
    setPassword("");
    setMode("login");
    setPortal(nextPortal);
  };

  // expectedPortal guards the two login forms against each other: a
  // student account can't get into the Staff portal and vice versa. The
  // Staff portal itself accepts any of warden/finance/technician — which
  // dashboard renders afterwards is decided by `actualRole`, not by a
  // separate login form per role.
  const handleLogin = async (expectedPortal) => {
    resetMessages();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      return setError(error.message);
    }

    const actualRole = await fetchRole(data.user.id);
    const actualIsStaff = STAFF_ROLES.includes(actualRole);

    if (expectedPortal === "staff" && !actualIsStaff) {
      await supabase.auth.signOut();
      setLoading(false);
      setUser(null);
      setRole(null);
      return setError("This account doesn't have staff access.");
    }
    if (expectedPortal === "student" && actualIsStaff) {
      await supabase.auth.signOut();
      setLoading(false);
      setUser(null);
      setRole(null);
      return setError("Staff accounts must use the Staff Login.");
    }

    if (rememberMe) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    setUser(data.user);
    setRole(actualRole);
    setLoading(false);
  };

  const handleSignUp = async () => {
    resetMessages();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) return setError(error.message);

    // If email confirmation is required, Supabase returns a user but no session yet.
    if (data.user && !data.session) {
      setInfo("Account created. Check your email to confirm before signing in.");
      setMode("login");
      return;
    }

    setUser(data.user ?? null);
    setRole("student");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (portal === "staff") return handleLogin("staff");
    if (mode === "login") return handleLogin("student");
    return handleSignUp();
  };

  const handleLogOut = async () => {
    resetMessages();
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    if (error) return setError(error.message);
    setUser(null);
    setRole(null);
  };

  // Placeholder for i-CATS identity SSO — wire up the real provider once
  // it's configured in the Supabase dashboard (Settings > Auth > Providers).
  const handleICatsLogin = async () => {
    resetMessages();
    setInfo("i-CATS Identity sign-in isn't set up yet.");
  };

  const switchMode = (nextMode) => {
    resetMessages();
    setMode(nextMode);
  };

  if (checkingSession) return null;

  if (user) {
    if (role === "warden") return <WardenDashboard user={user} onLogout={handleLogOut} />;
    if (role === "finance") return <FinanceDashboard user={user} onLogout={handleLogOut} />;
    if (role === "technician") return <TechnicianDashboard user={user} onLogout={handleLogOut} />;
    return <StudentDashboard user={user} onLogout={handleLogOut} />;
  }

  const isStaffPortal = portal === "staff";

  return (
    <div className="page">
      <HostelSlideshow />
      <div className="scrim" />

      <div className="container">
        <form className="card" onSubmit={handleSubmit}>
          <div className="avatar" aria-hidden="true" />
          <h1 className="title">{isStaffPortal ? "Staff Login" : "Welcome Back"}</h1>
          <p className="subtitle">
            {isStaffPortal
              ? "Sign in to your staff dashboard"
              : mode === "login"
              ? "Sign in to your hostel account"
              : "Create your hostel account"}
          </p>

          {error && (
            <p className="message message--error" role="alert">
              {error}
            </p>
          )}
          {info && (
            <p className="message message--info" role="status">
              {info}
            </p>
          )}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder={isStaffPortal ? "staff@icats.edu.my" : "you@icats.edu.my"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              type="password"
              autoComplete={!isStaffPortal && mode === "signup" ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>

          {!isStaffPortal && mode === "login" && (
            <label className="remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
          )}

          <button
            type="submit"
            className="primary-btn"
            disabled={loading || !email || !password}
          >
            {loading
              ? "Please wait…"
              : isStaffPortal
              ? "Sign In"
              : mode === "login"
              ? "Sign In"
              : "Sign Up"}
          </button>

          {!isStaffPortal && (
            <>
              <p className="switch-mode">
                {mode === "login" ? (
                  <>
                    Don't have an account?{" "}
                    <button type="button" onClick={() => switchMode("signup")}>
                      Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("login")}>
                      Sign In
                    </button>
                  </>
                )}
              </p>

              <div className="divider">
                <span>or</span>
              </div>

              <button type="button" className="sso-btn" onClick={handleICatsLogin}>
                Login with i-CATS Identity
              </button>
            </>
          )}

          <button
            type="button"
            className="portal-switch"
            onClick={() => switchPortal(isStaffPortal ? "student" : "staff")}
          >
            {isStaffPortal ? "← Back to student login" : "Staff? Login here"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
