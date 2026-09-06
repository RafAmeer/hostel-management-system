import { useEffect, useRef, useState } from "react";
import "./index.css";
import { supabase } from "./lib/supabaseClient";
import HostelSlideshow from "./components/HostelSlideshow";
import StudentDashboard from "./pages/StudentDashboard";

const REMEMBERED_EMAIL_KEY = "hostel_remembered_email";

function App() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [user, setUser] = useState(null);
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

  // Keep session in sync + react to auth changes
  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setCheckingSession(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetMessages = () => {
    setError("");
    setInfo("");
  };

  const handleLogin = async () => {
    resetMessages();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (error) return setError(error.message);

    if (rememberMe) {
      window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }

    setUser(data.user ?? null);
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
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "login") handleLogin();
    else handleSignUp();
  };

  const handleLogOut = async () => {
    resetMessages();
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    if (error) return setError(error.message);
    setUser(null);
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
    return <StudentDashboard user={user} onLogout={handleLogOut} />;
  }

  return (
    <div className="page">
      <HostelSlideshow />
      <div className="scrim" />

      <div className="container">
        <form className="card" onSubmit={handleSubmit}>
            <div className="avatar" aria-hidden="true" />
            <h1 className="title">Welcome Back</h1>
            <p className="subtitle">
              {mode === "login" ? "Sign in to your hostel account" : "Create your hostel account"}
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
                placeholder="you@icats.edu.my"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>

            {mode === "login" && (
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
                : mode === "login"
                ? "Sign In"
                : "Sign Up"}
            </button>

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

            <button
              type="button"
              className="sso-btn"
              onClick={handleICatsLogin}
            >
              Login with i-CATS Identity
            </button>
        </form>
      </div>
    </div>
  );
}

export default App;