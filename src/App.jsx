import { useEffect, useState } from "react";
import "./index.css";
import { supabase } from "./lib/supabaseClient";
import HostelSlideshow from "./components/HostelSlideshow";
import StudentDashboard from "./pages/StudentDashboard";
import WardenDashboard from "./pages/WardenDashboard";
import FinanceDashboard from "./pages/FinanceDashboard";
import TechnicianDashboard from "./pages/TechnicianDashboard";
import CurfewScanPage from "./pages/CurfewScanPage";

// Warden, Finance and Technician all share one "Staff" sign-in page now
// (previously each had — or would have needed — its own login form).
// Which dashboard renders after signing in is decided purely by the
// `role` column, not by which login form was used.
const STAFF_ROLES = ["warden", "finance", "technician"];
const STAFF_ROLE_LABELS = { warden: "Warden", finance: "Finance", technician: "Technician" };

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
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot" | "reset" (both portals)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState(""); // "reset" mode only
  const [staffTitle, setStaffTitle] = useState(""); // staff signup only
  const [fullName, setFullName] = useState(""); // staff signup only
  const [staffRole, setStaffRole] = useState("warden"); // staff signup only
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Clicking the "reset password" email link lands back here with a
      // temporary recovery session — show the "choose a new password"
      // form instead of dropping the user straight into a dashboard.
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        return;
      }
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
    setFullName("");
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

    let actualRole = await fetchRole(data.user.id);

    // Belt-and-braces fallback only: the real fix is the database trigger
    // in supabase/migrations/2026-09-22_phase1_profile_and_staff_fix.sql,
    // which sets the requested role at profile-creation time (server-side,
    // so it isn't blocked by RLS). This client-side attempt only helps
    // accounts created before that migration is run, and will silently
    // no-op (fine) once RLS is in place, since the trigger already did it.
    const requestedRole = data.user.user_metadata?.requested_role;
    if (actualRole === "student" && STAFF_ROLES.includes(requestedRole)) {
      const { error: upgradeError } = await supabase
        .from("profiles")
        .update({ role: requestedRole })
        .eq("id", data.user.id);
      if (!upgradeError) actualRole = requestedRole;
    }

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

  // Shared signup for both portals. Student signups keep the existing
  // default role ("student", set by the profiles-insert trigger). Staff
  // signups pass the chosen role through as auth user_metadata
  // (`requested_role`) and, when a session comes back immediately (email
  // confirmation off), apply it to `profiles.role` right away; otherwise
  // handleLogin reconciles it the first time the confirmed account logs in.
  const handleSignUp = async (expectedPortal) => {
    resetMessages();
    setLoading(true);

    const isStaffSignup = expectedPortal === "staff";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Without this, Supabase's confirmation email sends people to a
        // generic Supabase page instead of back into this app.
        emailRedirectTo: window.location.origin,
        data: isStaffSignup
          ? { requested_role: staffRole, title: staffTitle || undefined, full_name: fullName || undefined }
          : undefined,
      },
    });

    if (error) {
      setLoading(false);
      return setError(error.message);
    }

    // If email confirmation is required, Supabase returns a user but no session yet.
    if (data.user && !data.session) {
      setLoading(false);
      setInfo(
        isStaffSignup
          ? `Staff account created as ${STAFF_ROLE_LABELS[staffRole]}. Check your email to confirm, then sign in above.`
          : "Account created. Check your email to confirm before signing in."
      );
      setMode("login");
      return;
    }

    if (isStaffSignup) {
      await supabase
        .from("profiles")
        .update({
          role: staffRole,
          ...(fullName ? { full_name: fullName } : {}),
          ...(staffTitle ? { title: staffTitle } : {}),
        })
        .eq("id", data.user.id);
    }

    setLoading(false);
    setUser(data.user ?? null);
    setRole(isStaffSignup ? staffRole : "student");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) return setError(error.message);
    setInfo("Check your email for a link to reset your password.");
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    resetMessages();
    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return setError(error.message);
    setNewPassword("");
    setInfo("Password updated. Signing you in…");
    // The recovery session is already a real session, so onAuthStateChange
    // will pick it up and route to the right dashboard on its own.
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const expectedPortal = portal === "staff" ? "staff" : "student";
    if (mode === "login") return handleLogin(expectedPortal);
    if (mode === "forgot") return handleForgotPassword(e);
    if (mode === "reset") return handleResetPassword(e);
    return handleSignUp(expectedPortal);
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

  const switchMode = (nextMode) => {
    resetMessages();
    setPassword("");
    setNewPassword("");
    setMode(nextMode);
  };

  // Public route, reachable without logging in: the entrance QR poster
  // (or the in-page camera fallback) opens exactly this path. Checked
  // before the session check below so it doesn't wait on an auth lookup
  // it never needs.
  if (window.location.pathname === "/curfew") {
    return <CurfewScanPage />;
  }

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
          <img src="/logo.png" alt="" className="avatar" aria-hidden="true" />
          <p className="brand-name">DormSphere</p>
          <h1 className="title">
            {mode === "forgot"
              ? "Reset your password"
              : mode === "reset"
              ? "Choose a new password"
              : isStaffPortal
              ? mode === "login"
                ? "Staff Login"
                : "Staff Sign Up"
              : "Welcome Back"}
          </h1>
          <p className="subtitle">
            {mode === "forgot"
              ? "We'll email you a link to reset it."
              : mode === "reset"
              ? "Enter a new password for your account."
              : isStaffPortal
              ? mode === "login"
                ? "Sign in to your staff dashboard"
                : "Create a Warden, Finance, or Technician account"
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

          {isStaffPortal && mode === "signup" && (
            <>
              <label className="field">
                <span className="field__label">Title</span>
                <select value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} required>
                  <option value="" disabled>
                    Select title
                  </option>
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mdm">Mdm</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">Full name</span>
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Ahmad bin Ismail"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </label>

              <label className="field">
                <span className="field__label">Role</span>
                <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
                  <option value="warden">Warden</option>
                  <option value="finance">Finance</option>
                  <option value="technician">Technician</option>
                </select>
              </label>
            </>
          )}

          {mode !== "reset" && (
            <label className="field">
              <span className="field__label">Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder={isStaffPortal ? "staff@dormsphere.edu.my" : "you@dormsphere.edu.my"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          )}

          {mode !== "forgot" && (
            <label className="field">
              <span className="field__label">{mode === "reset" ? "New password" : "Password"}</span>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : mode === "reset" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={mode === "reset" ? newPassword : password}
                  onChange={(e) => (mode === "reset" ? setNewPassword(e.target.value) : setPassword(e.target.value))}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="password-input__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </label>
          )}

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

          {mode === "login" && (
            <button type="button" className="forgot-password-link" onClick={() => switchMode("forgot")}>
              Forgot password?
            </button>
          )}

          <button
            type="submit"
            className="primary-btn"
            disabled={
              loading ||
              (mode === "forgot" ? !email : mode === "reset" ? !newPassword : !email || !password) ||
              (isStaffPortal && mode === "signup" && (!fullName || !staffTitle))
            }
          >
            {loading
              ? "Please wait…"
              : mode === "forgot"
              ? "Send reset link"
              : mode === "reset"
              ? "Update password"
              : mode === "login"
              ? "Sign In"
              : "Sign Up"}
          </button>

          {mode === "forgot" ? (
            <p className="switch-mode">
              <button type="button" onClick={() => switchMode("login")}>
                ← Back to sign in
              </button>
            </p>
          ) : mode === "reset" ? null : (
            <p className="switch-mode">
              {mode === "login" ? (
                <>
                  {isStaffPortal ? "New staff member? " : "Don't have an account? "}
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
          )}

          {mode !== "reset" && (
            <button
              type="button"
              className="portal-switch"
              onClick={() => switchPortal(isStaffPortal ? "student" : "staff")}
            >
              {isStaffPortal ? "← Back to student login" : "Staff? Login here"}
            </button>
          )}

          {!isStaffPortal && mode === "login" && (
            <a className="portal-switch" href="/curfew">
              Scan curfew QR instead
            </a>
          )}
        </form>
      </div>
    </div>
  );
}

export default App;
