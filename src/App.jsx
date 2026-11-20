import { lazy, Suspense, useEffect, useState } from "react";
import "./index.css";
import "./auth.css";
// The dashboards' styles stay in the main stylesheet, in their original
// order, even though the dashboards' code is now loaded on demand (see the
// lazy() imports below). Styles are small, and keeping one stylesheet means
// the look can't change depending on which dashboard happened to load first.
import "./dashboard.css";
import "./student-theme.css";
import "./feedback-updates.css";
import "./mobile.css";
import "./warden-console.css";
// One shared "Earthy & Serene" palette for every side — must stay last.
import "./earthy-theme.css";
import ThemeToggle from "./components/ThemeToggle";
import HostelSlideshow from "./components/HostelSlideshow";
import { supabase } from "./lib/supabaseClient";
import { assetUrl } from "./lib/assetUrl";
import Toast from "./components/Toast";
import SplashScreen from "./components/SplashScreen";
import SessionTimeoutModal from "./components/SessionTimeoutModal";
import BiometricPrompt from "./components/BiometricPrompt";
import { useIdleTimeout } from "./hooks/useIdleTimeout";
import { useAwayLogout } from "./hooks/useAwayLogout";
import { ensureDeviceBinding } from "./lib/deviceBinding";
import "./hooks/useTheme";
import { useToast } from "./hooks/useToast";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { loginWithPasskey, passkeysSupported } from "./lib/passkeys";
import StalePasskeyHelp from "./components/StalePasskeyHelp";
import { FingerprintIcon, EyeIcon, EyeOffIcon, ScanIcon, DownloadIcon, ShieldIcon } from "./components/dashboard/icons";

// Each dashboard is downloaded only when it's needed (student feedback asked
// for faster loading). Before this, a student's phone had to download the
// warden's charts, reports and AI screens — and the sign-in page waited for
// all of it too.
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const WardenDashboard = lazy(() => import("./pages/WardenDashboard"));
const FinanceDashboard = lazy(() => import("./pages/FinanceDashboard"));
const TechnicianDashboard = lazy(() => import("./pages/TechnicianDashboard"));
const CurfewScanPage = lazy(() => import("./pages/CurfewScanPage"));

// Warden, Finance and Technician all share one "Staff" sign-in page now
// (previously each had — or would have needed — its own login form).
// Which dashboard renders after signing in is decided purely by the
// `role` column, not by which login form was used.
const STAFF_ROLES = ["warden", "finance", "technician"];
const STAFF_ROLE_LABELS = { warden: "Warden", finance: "Finance", technician: "Technician" };

const REMEMBERED_EMAIL_KEY = "hostel_remembered_email";

// Session timeout: 15 minutes in total. After 14 minutes with no activity a
// 60-second warning appears; if nobody responds, the user is signed out.
// (Change IDLE_TIMEOUT_MS to make it longer or shorter.)
const IDLE_TIMEOUT_MS = 14 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;

// Leaving the site (another tab/app, locked screen) for this long signs the
// user out. Closing the tab or browser signs out immediately because the
// session is kept in sessionStorage (see lib/supabaseClient.js).
const AWAY_LOGOUT_MS = 10 * 60 * 1000; // 10 minutes

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

// Supabase's built-in email sender only allows a handful of emails per hour
// (sign-up confirmations and password resets share that quota), so hitting
// "email rate limit exceeded" is common while testing. Turn the raw error
// into something a person can act on.
const EMAIL_COOLDOWN_SECONDS = 60;

function friendlyAuthError(error) {
  const msg = error?.message ?? "Something went wrong. Please try again.";
  if (error?.code === "over_email_send_rate_limit" || /rate limit/i.test(msg)) {
    return "Too many emails were requested. Please wait a few minutes and try again — and check your inbox (and spam folder) for an email we already sent.";
  }
  if (error?.code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/i.test(msg)) {
    return "Your password is correct, but this email hasn't been confirmed yet. Open the confirmation link we emailed you (check Spam / Promotions too), or resend it below.";
  }
  if (/invalid staff code/i.test(msg) || /database error saving new user/i.test(msg)) {
    return "That staff code isn't right. Ask the hostel office for the current code.";
  }
  if (error?.code === "user_already_exists" || /already (registered|exists)/i.test(msg)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  return msg;
}

function MainApp() {
  // Which login screen is showing when signed out — no longer a dashboard
  // toggle, just which form the person sees before they've authenticated.
  const [portal, setPortal] = useState("student"); // "student" | "staff"
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot" | "reset" (both portals)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); // signup only
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState(""); // "reset" mode only
  const [staffTitle, setStaffTitle] = useState(""); // staff signup only
  const [fullName, setFullName] = useState(""); // staff signup only
  const [staffRole, setStaffRole] = useState("warden"); // staff signup only
  const [staffCode, setStaffCode] = useState(""); // staff signup only — given out by the hostel office
  const [rememberMe, setRememberMe] = useState(false);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false); // login hit "email not confirmed"
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [staleHelp, setStaleHelp] = useState(null); // null | { forgotten: boolean }
  const { toast, notify, dismiss } = useToast();
  const { canInstall, showIosHint, install } = usePwaInstall();
  const [splashMinDone, setSplashMinDone] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // Keep the splash up for a beat even when the session check is instant,
  // so it reads as a deliberate loading screen instead of a flicker.
  useEffect(() => {
    const t = setTimeout(() => setSplashMinDone(true), 1100);
    return () => clearTimeout(t);
  }, []);

  // Ticks once a second only while an email cooldown is running.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const startEmailCooldown = () => {
    setNow(Date.now());
    setCooldownUntil(Date.now() + EMAIL_COOLDOWN_SECONDS * 1000);
  };

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

    // try/finally: if the network drops during the first session check the
    // splash screen still goes away and the login form shows, instead of
    // the app sitting on the splash forever.
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await syncFromSession(session);
      } catch {
        setUser(null);
        setRole(null);
      } finally {
        setCheckingSession(false);
      }
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
    setNeedsConfirm(false);
  };

  const switchPortal = (nextPortal) => {
    resetMessages();
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setStaffCode("");
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
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      const message = friendlyAuthError(error);
      notify(message, "error");
      setError(message);
      if (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message ?? "")) {
        setNeedsConfirm(true);
      }
      return;
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
      notify("This account doesn't have staff access.", "error");
      return setError("This account doesn't have staff access.");
    }
    if (expectedPortal === "student" && actualIsStaff) {
      await supabase.auth.signOut();
      setLoading(false);
      setUser(null);
      setRole(null);
      notify("Staff accounts must use the Staff Login.", "error");
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
    notify("Signed in. Welcome back!", "success");
  };

  // Shared signup for both portals. Student signups keep the existing
  // default role ("student", set by the profiles-insert trigger). Staff
  // signups pass the chosen role through as auth user_metadata
  // (`requested_role`) and, when a session comes back immediately (email
  // confirmation off), apply it to `profiles.role` right away; otherwise
  // handleLogin reconciles it the first time the confirmed account logs in.
  const handleSignUp = async (expectedPortal) => {
    resetMessages();

    // Student testing: accounts were created with a mistyped (hidden)
    // password, and sign-in then failed with "incorrect password". Typing it
    // twice catches that before the account exists.
    if (password !== confirmPassword) {
      const message = "The two passwords don't match. Please type them again.";
      notify(message, "error");
      return setError(message);
    }

    setLoading(true);

    const isStaffSignup = expectedPortal === "staff";

    // Staff accounts need the staff code. The database checks it again when
    // the account is created (handle_new_user), so this is just for a clear
    // message instead of a generic "Database error".
    if (isStaffSignup) {
      const { data: codeOk, error: codeError } = await supabase.rpc("verify_staff_code", {
        p_code: staffCode.trim(),
      });
      if (codeError || !codeOk) {
        setLoading(false);
        const message = codeError
          ? `Couldn't check the staff code: ${codeError.message}`
          : "That staff code isn't right. Ask the hostel office for the current code.";
        notify(message, "error");
        return setError(message);
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // Without this, Supabase's confirmation email sends people to a
        // generic Supabase page instead of back into this app.
        emailRedirectTo: window.location.origin,
        data: isStaffSignup
          ? {
              requested_role: staffRole,
              staff_code: staffCode.trim(),
              title: staffTitle || undefined,
              full_name: fullName || undefined,
            }
          : undefined,
      },
    });

    if (error) {
      setLoading(false);
      // Both a rate-limit hit and a successful send use up email quota, so
      // pause the button either way to stop repeat clicks burning it.
      if (error.code === "over_email_send_rate_limit" || /rate limit/i.test(error.message)) {
        startEmailCooldown();
      }
      const message = friendlyAuthError(error);
      notify(message, "error");
      return setError(message);
    }

    // Supabase doesn't return an error when the email already has an
    // account (so attackers can't probe for emails). It returns a fake user
    // with an empty `identities` list instead — that's our signal.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setLoading(false);
      const message = "Account already created with this email. Please sign in instead.";
      notify(message, "error");
      setMode("login");
      setPassword("");
      return setError(message);
    }

    // Signing up AGAIN with an email that's still waiting for confirmation
    // only re-sends the link — Supabase keeps the FIRST password and ignores
    // the new one. Saying "Account created" here made testers think the new
    // password was saved, and then sign-in failed with "incorrect password".
    const createdMs = data.user?.created_at ? Date.parse(data.user.created_at) : NaN;
    if (data.user && !data.session && Number.isFinite(createdMs) && Date.now() - createdMs > 60_000) {
      setLoading(false);
      startEmailCooldown();
      notify("This email already has an account waiting for confirmation.", "error");
      setInfo(
        "This email already has an account that hasn't been confirmed yet, so we re-sent the confirmation link (check Spam / Promotions too). Your password is still the one you chose the first time — if you're not sure of it, use \"Forgot password?\" after confirming."
      );
      setMode("login");
      setPassword("");
      return;
    }

    // If email confirmation is required, Supabase returns a user but no session yet.
    if (data.user && !data.session) {
      setLoading(false);
      startEmailCooldown();
      notify("Account created. Check your email to confirm it.", "success");
      const address = email.trim();
      setInfo(
        (isStaffSignup ? `Staff account created as ${STAFF_ROLE_LABELS[staffRole]}. ` : "Account created. ") +
          `One more step: open the confirmation link we emailed to ${address} — you can't sign in until you do. ` +
          "It can take a minute, so check Spam / Promotions too. Nothing there? Use the resend button below."
      );
      setMode("login");
      setPassword("");
      setConfirmPassword("");
      // Shows "Resend confirmation email" straight away, instead of only
      // after a failed sign-in attempt.
      setNeedsConfirm(true);
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
    notify("Account created. Welcome to DormSphere!", "success");
  };

  // Biometric sign-in. The session it creates goes through the same
  // onAuthStateChange -> role lookup as a password login; the portal
  // (student/staff) is decided by the account's role.
  const handlePasskeyLogin = async () => {
    resetMessages();
    setLoading(true);
    try {
      await loginWithPasskey();
      notify("Signed in. Welcome back!", "success");
    } catch (e) {
      notify(e.message, "error");
      setError(e.message);
      if (e.unknownCredential) setStaleHelp({ forgotten: Boolean(e.forgotten) });
    }
    setLoading(false);
  };

  // Re-send the sign-up confirmation link (shown after a login attempt
  // fails with "email not confirmed").
  const handleResendConfirmation = async () => {
    const address = email.trim();
    if (!address) return setError("Enter your email first.");
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: address,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      if (error.code === "over_email_send_rate_limit" || /rate limit/i.test(error.message)) {
        startEmailCooldown();
      }
      const message = friendlyAuthError(error);
      notify(message, "error");
      return setError(message);
    }
    startEmailCooldown();
    setError("");
    setNeedsConfirm(true);
    notify("Confirmation email sent again.", "success");
    setInfo(`We sent a new confirmation link to ${address}. It can take a minute — check Spam / Promotions too.`);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (error) {
      if (error.code === "over_email_send_rate_limit" || /rate limit/i.test(error.message)) {
        startEmailCooldown();
      }
      const message = friendlyAuthError(error);
      notify(message, "error");
      return setError(message);
    }
    startEmailCooldown();
    notify("Reset link sent. Check your email.", "success");
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
    if (error) {
      notify(error.message, "error");
      return setError(error.message);
    }
    setNewPassword("");
    notify("Password updated.", "success");
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
    notify("Signed out.", "info");
  };

  const handleIdleTimeout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    notify("Signed out due to inactivity.", "info");
  };

  const { secondsLeft, stayActive } = useIdleTimeout({
    enabled: Boolean(user),
    idleMs: IDLE_TIMEOUT_MS,
    warnMs: IDLE_WARNING_MS,
    onTimeout: handleIdleTimeout,
  });

  // Leaving the site for 10 minutes or more also signs the user out.
  useAwayLogout({
    enabled: Boolean(user),
    awayMs: AWAY_LOGOUT_MS,
    onTimeout: handleIdleTimeout,
  });

  // Students: remember this phone so the curfew QR can identify them
  // without another login. Only a real login/session creates the binding.
  useEffect(() => {
    if (!user || role !== "student") return;
    ensureDeviceBinding(user.id).then((res) => {
      if (res?.status === "owned_by_other") {
        notify(
          "This phone is already registered to another student for curfew scans, so it can't scan for you.",
          "info"
        );
      }
    }).catch(() => {
      /* binding is retried on the next login; never break the dashboard */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role]);

  const switchMode = (nextMode) => {
    resetMessages();
    setPassword("");
    setConfirmPassword("");
    setNewPassword("");
    setMode(nextMode);
  };

  // Toast + splash sit on top of every screen (login, dashboards, scan page).
  const overlays = (
    <>
      <Toast toast={toast} onDismiss={dismiss} />
      <SplashScreen done={splashMinDone && !checkingSession} />
    </>
  );

  if (checkingSession) return overlays;

  // Shown for the moment a dashboard's code is still downloading.
  const loadingScreen = <SplashScreen done={false} />;

  if (user) {
    const dashboard =
      role === "warden" ? (
        <WardenDashboard user={user} onLogout={handleLogOut} />
      ) : role === "finance" ? (
        <FinanceDashboard user={user} onLogout={handleLogOut} />
      ) : role === "technician" ? (
        <TechnicianDashboard user={user} onLogout={handleLogOut} />
      ) : (
        <StudentDashboard user={user} onLogout={handleLogOut} />
      );
    return (
      <>
        <Suspense fallback={loadingScreen}>{dashboard}</Suspense>
        <SessionTimeoutModal secondsLeft={secondsLeft} onStay={stayActive} onLogout={handleLogOut} />
        <BiometricPrompt userId={user.id} onDone={(msg) => notify(msg, "success")} />
        {overlays}
      </>
    );
  }

  const isStaffPortal = portal === "staff";
  const showPortalTabs = mode === "login" || mode === "signup";
  const canUsePasskey = mode === "login" && passkeysSupported();

  const heading =
    mode === "forgot"
      ? "Reset your password"
      : mode === "reset"
      ? "Choose a new password"
      : mode === "signup"
      ? isStaffPortal
        ? "Create a staff account"
        : "Create your account"
      : isStaffPortal
      ? "Staff sign in"
      : "Sign in";

  const subheading =
    mode === "forgot"
      ? "Enter your account email and we'll send you a reset link."
      : mode === "reset"
      ? "Enter a new password for your account."
      : mode === "signup"
      ? isStaffPortal
        ? "For wardens, finance and technicians. You'll need a staff code from the hostel office."
        : "Use your student email to get started."
      : isStaffPortal
      ? "Wardens, finance and technicians."
      : "Welcome back. Sign in to your hostel account.";

  // Sign-in page: a quiet split layout — hostel photos with a short intro on
  // the left, a plain solid form on the right (stacked on phones). All the
  // form logic below is unchanged; only the layout and styling moved to
  // src/auth.css.
  return (
    <>
    <div className="auth">
      <aside className="auth__showcase" aria-hidden="true">
        <HostelSlideshow />
        <div className="auth__showcase-shade" />
        <div className="auth__showcase-content">
          <div className="auth__brand auth__brand--light">
            <span className="auth__mark">
              <img src={assetUrl("logo.png")} alt="" />
            </span>
            <span className="auth__brand-name">DormSphere</span>
          </div>

          <div className="auth__pitch">
            <h2 className="auth__pitch-title">Hostel life, managed in one place.</h2>
            <p className="auth__pitch-text">
              Room booking, maintenance requests and curfew records in one app — for students and hostel staff.
            </p>
            <ul className="auth__points">
              <li>Book a room and follow its approval</li>
              <li>Report problems and track the repair</li>
              <li>Check in and out with the hostel QR</li>
            </ul>
          </div>

          <p className="auth__showcase-foot">DormSphere · Hostel Management System</p>
        </div>
      </aside>

      <main className="auth__panel">
        <div className="auth__panel-top">
          <div className="auth__brand auth__brand--compact">
            <span className="auth__mark">
              <img src={assetUrl("logo.png")} alt="" />
            </span>
            <span className="auth__brand-name">DormSphere</span>
          </div>
          <ThemeToggle className="auth__theme" />
        </div>

        <form className="auth__form" onSubmit={handleSubmit} noValidate={false}>
          {showPortalTabs && (
            <div className="auth__tabs" role="tablist" aria-label="Account type">
              <button
                type="button"
                role="tab"
                aria-selected={!isStaffPortal}
                className={"auth__tab" + (!isStaffPortal ? " auth__tab--active" : "")}
                onClick={() => isStaffPortal && switchPortal("student")}
              >
                Student
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isStaffPortal}
                className={"auth__tab" + (isStaffPortal ? " auth__tab--active" : "")}
                onClick={() => !isStaffPortal && switchPortal("staff")}
              >
                Staff
              </button>
            </div>
          )}

          <h1 className="auth__title">{heading}</h1>
          <p className="auth__subtitle">{subheading}</p>

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
          {needsConfirm && mode === "login" && (
            <button
              type="button"
              className="auth__link auth__link--strong"
              onClick={handleResendConfirmation}
              disabled={loading || cooldownLeft > 0}
            >
              {cooldownLeft > 0 ? `Resend available in ${cooldownLeft}s` : "Resend confirmation email"}
            </button>
          )}

          {isStaffPortal && mode === "signup" && (
            <>
              <div className="auth__row">
                <label className="field auth__field--narrow">
                  <span className="field__label">Title</span>
                  <select value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} required>
                    <option value="" disabled>
                      Select
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
              </div>

              <div className="auth__row">
                <label className="field">
                  <span className="field__label">Role</span>
                  <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)}>
                    <option value="warden">Warden</option>
                    <option value="finance">Finance</option>
                    <option value="technician">Technician</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Staff code</span>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="DS-XXXX-XXXX"
                    value={staffCode}
                    onChange={(e) => setStaffCode(e.target.value)}
                    required
                  />
                </label>
              </div>
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
                  placeholder={mode === "login" ? "Enter your password" : "At least 6 characters"}
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
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>
          )}

          {mode === "signup" && (
            <label className="field">
              <span className="field__label">Confirm password</span>
              <div className="password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Type the same password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              {confirmPassword && confirmPassword !== password && (
                <span className="field__hint field__hint--error" role="status">
                  Doesn't match the password above yet.
                </span>
              )}
            </label>
          )}

          {mode === "login" && (
            <div className="auth__row auth__row--between">
              {!isStaffPortal ? (
                <label className="auth__check">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
              ) : (
                <span />
              )}
              <button type="button" className="auth__link" onClick={() => switchMode("forgot")}>
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="auth__submit"
            disabled={
              loading ||
              (mode === "forgot" ? !email : mode === "reset" ? !newPassword : !email || !password) ||
              (mode === "signup" && !confirmPassword) ||
              (isStaffPortal && mode === "signup" && (!fullName || !staffTitle || !staffCode.trim())) ||
              ((mode === "signup" || mode === "forgot") && cooldownLeft > 0)
            }
          >
            {loading
              ? "Please wait…"
              : (mode === "signup" || mode === "forgot") && cooldownLeft > 0
              ? `Try again in ${cooldownLeft}s`
              : mode === "forgot"
              ? "Send reset link"
              : mode === "reset"
              ? "Update password"
              : mode === "login"
              ? "Sign in"
              : "Create account"}
          </button>

          {mode === "signup" && !isStaffPortal && (
            <p className="auth__privacy">
              <ShieldIcon aria-hidden="true" />
              <span>
                Your details are only visible to you and hostel staff. Your password is stored encrypted — nobody at
                the hostel can read it.
              </span>
            </p>
          )}

          {canUsePasskey && (
            <>
              <div className="auth__divider">
                <span>or</span>
              </div>
              <button type="button" className="auth__secondary" onClick={handlePasskeyLogin} disabled={loading}>
                <FingerprintIcon aria-hidden="true" /> Sign in with fingerprint
              </button>
              <StalePasskeyHelp
                open={Boolean(staleHelp)}
                forgotten={staleHelp?.forgotten}
                onToggle={() => setStaleHelp((v) => (v ? null : { forgotten: false }))}
              />
            </>
          )}

          {mode === "forgot" ? (
            <p className="auth__switch">
              <button type="button" className="auth__link" onClick={() => switchMode("login")}>
                ← Back to sign in
              </button>
            </p>
          ) : mode === "reset" ? null : (
            <p className="auth__switch">
              {mode === "login" ? (
                <>
                  {isStaffPortal ? "New staff member? " : "New to DormSphere? "}
                  <button type="button" className="auth__link auth__link--strong" onClick={() => switchMode("signup")}>
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button type="button" className="auth__link auth__link--strong" onClick={() => switchMode("login")}>
                    Sign in
                  </button>
                </>
              )}
            </p>
          )}
        </form>

        <div className="auth__extras">
          {!isStaffPortal && mode === "login" && (
            <a className="auth__scan" href={assetUrl("curfew")}>
              <span className="auth__scan-icon" aria-hidden="true">
                <ScanIcon />
              </span>
              <span className="auth__scan-text">
                <strong>Curfew check-in / check-out</strong>
                <small>Scan the QR poster at your hostel entrance</small>
              </span>
              <span className="auth__scan-arrow" aria-hidden="true">→</span>
            </a>
          )}

          {mode === "login" && canInstall && (
            <button type="button" className="auth__install" onClick={install}>
              <DownloadIcon aria-hidden="true" /> Install the DormSphere app
            </button>
          )}
          {mode === "login" && showIosHint && (
            <p className="auth__hint">
              To install on iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
            </p>
          )}
        </div>

        <p className="auth__legal">© {new Date().getFullYear()} DormSphere. All rights reserved.</p>
      </main>
    </div>
    {overlays}
    </>
  );
}

// The curfew page is public (a poster QR opens it) and has nothing to do with
// the login session, so it gets its own tiny root: no session lookup, no
// splash screen waiting on one, no idle/away timers, no device binding.
// Previously it was rendered from inside the main App, whose splash stayed
// on top of the scan page until the session check finished — on a phone
// that could look like the page "won't load until you refresh".
function App() {
  // Matches "/curfew" at the site root and under Vite's `base` path
  // (e.g. "/hostel-management-system/curfew" when running `npm run dev`).
  if (/(^|\/)curfew\/?$/.test(window.location.pathname)) {
    return (
      <Suspense fallback={<SplashScreen done={false} />}>
        <CurfewScanPage />
      </Suspense>
    );
  }
  return <MainApp />;
}

export default App;
