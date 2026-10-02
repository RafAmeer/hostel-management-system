import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isPhoneDevice } from "../lib/device";
import { getCurrentPosition } from "../lib/geo";

// Public route: /curfew?loc=Main%20Entrance
//
// Two ways to land here, both without logging in:
//   1. Scanning a poster QR at the entrance with the phone's own camera app
//      — that just opens this exact URL, ?loc= already filled in.
//   2. Opening /curfew directly (e.g. the "Scan curfew QR instead" link on
//      the login page) — there's no ?loc= yet, so this page opens its OWN
//      camera immediately and reads a poster QR itself, no button needed.
// See supabase/migrations/2026-09-27_curfew_device_binding.sql and
// supabase/functions/curfew-scan for the server side of this flow.
const DEVICE_TOKEN_KEY = "dormsphere_curfew_device_token";

const RETURN_TO_LOGIN_MS = 3500;

function goToLogin() {
  window.location.assign("/");
}

async function callCurfewScan(deviceToken, location, coords) {
  const { data, error } = await supabase.functions.invoke("curfew-scan", {
    body: {
      device_token: deviceToken,
      location,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
    },
  });
  // supabase-js only rejects on network failure — a 4xx/5xx from the
  // function still resolves here with `error` set from the response body.
  if (error) {
    const message = data?.error || error.message || "device_not_recognized";
    throw new Error(message);
  }
  return data;
}

function CurfewScanPage() {
  const [location, setLocation] = useState(null);
  // "scanner" | "checking" | "binding" | "scanning" | "success" | "error"
  const [phase, setPhase] = useState("checking");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const ranOnce = useRef(false);

  const runScan = async (deviceToken, loc) => {
    // Location first: a check-in/out only counts when the phone is at the
    // hostel, so the GPS read happens before anything is logged.
    setPhase("locating");
    let coords;
    try {
      coords = await getCurrentPosition();
    } catch (err) {
      setErrorMessage(err.message);
      setPhase("error");
      return;
    }

    setPhase("scanning");
    try {
      const data = await callCurfewScan(deviceToken, loc, coords);
      setResult(data);
      setPhase("success");
    } catch (err) {
      if (err.message === "device_not_recognized") {
        window.localStorage.removeItem(DEVICE_TOKEN_KEY);
        setPhase("binding");
      } else if (err.message === "outside_hostel_area") {
        setErrorMessage("You're not at the hostel. Move to the entrance and scan again.");
        setPhase("error");
      } else {
        setErrorMessage(err.message);
        setPhase("error");
      }
    }
  };

  // After a successful scan, send the phone back to the login page.
  useEffect(() => {
    if (phase !== "success") return undefined;
    const t = setTimeout(goToLogin, RETURN_TO_LOGIN_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const proceedWithLocation = (loc) => {
    setLocation(loc);
    // Keeps the URL consistent with a real poster scan, so a refresh on
    // this same phone re-checks-in/out at the same entrance instead of
    // re-opening the camera again.
    window.history.replaceState(null, "", `/curfew?loc=${encodeURIComponent(loc)}`);
    const savedToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (savedToken) runScan(savedToken, loc);
    else setPhase("binding");
  };

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    const params = new URLSearchParams(window.location.search);
    const locFromUrl = params.get("loc");
    if (locFromUrl) {
      proceedWithLocation(locFromUrl);
    } else {
      // No ?loc= yet — this wasn't opened via an actual poster scan, so
      // open the camera straight away instead of showing a button first.
      setPhase("scanner");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBind = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setSubmitting(false);
      setErrorMessage(authError.message);
      return;
    }

    const deviceToken = crypto.randomUUID();
    const { error: bindError } = await supabase.from("device_bindings").insert({
      student_id: authData.user.id,
      device_token: deviceToken,
      label: navigator.userAgent.slice(0, 120),
    });

    // Whether or not the binding write succeeded, don't leave a lingering
    // session on this shared entrance flow — from here on identity comes
    // from the device_token alone, not a session.
    await supabase.auth.signOut();

    if (bindError) {
      setSubmitting(false);
      setErrorMessage("Couldn't remember this device: " + bindError.message);
      setPhase("error");
      return;
    }

    window.localStorage.setItem(DEVICE_TOKEN_KEY, deviceToken);
    setSubmitting(false);
    await runScan(deviceToken, location);
  };

  const handleUseDifferentAccount = () => {
    window.localStorage.removeItem(DEVICE_TOKEN_KEY);
    setResult(null);
    setErrorMessage("");
    setPhase("binding");
  };

  // Scanning is phone-only (camera + GPS at the entrance).
  if (!isPhoneDevice()) {
    return (
      <div className="page">
        <div className="scrim" />
        <div className="container">
          <div className="card">
            <img src="/logo.png" alt="" className="avatar" aria-hidden="true" />
            <p className="brand-name">DormSphere</p>
            <h1 className="title">Phone only</h1>
            <p className="tab__subtitle-text">
              Curfew scanning is only available on a phone. Open DormSphere on your phone at the
              hostel entrance.
            </p>
            <button type="button" className="primary-btn primary-btn--wide" onClick={goToLogin}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "scanner") {
    return <QrCameraScanner onDecoded={proceedWithLocation} />;
  }

  return (
    <div className="page">
      <div className="scrim" />
      <div className="container">
        <div className="card">
          <img src="/logo.png" alt="" className="avatar" aria-hidden="true" />
          <p className="brand-name">DormSphere</p>
          <h1 className="title">Curfew Check-In</h1>
          {location && <p className="subtitle">{location}</p>}

          {phase === "checking" && <p className="tab__message">Checking this device…</p>}

          {phase === "locating" && <p className="tab__message">Checking your location…</p>}

          {phase === "scanning" && <p className="tab__message">Logging your scan…</p>}

          {phase === "success" && result && (
            <div className="glass-panel curfew-status" style={{ textAlign: "center" }}>
              <p className="curfew-status__value">
                <span className={"badge badge--" + (result.scan_type === "check_out" ? "warn" : "ok")}>
                  {result.scan_type === "check_out" ? "Checked Out ✅" : "Checked In ✅"}
                </span>
              </p>
              {result.student_name && <p className="list-row__meta">{result.student_name}</p>}
              <p className="list-row__meta">
                {new Date(result.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="list-row__meta">Returning to login…</p>
            </div>
          )}

          {phase === "error" && (
            <p className="message message--error" role="alert">
              {errorMessage || "Something went wrong."}
            </p>
          )}

          {phase === "binding" && (
            <form onSubmit={handleBind}>
              <p className="tab__subtitle-text">
                First time on this phone — log in once. After this, checking
                in/out at the entrance won't need a login again.
              </p>
              {errorMessage && (
                <p className="message message--error" role="alert">
                  {errorMessage}
                </p>
              )}
              <label className="field">
                <span className="field__label">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="primary-btn primary-btn--wide" disabled={submitting}>
                {submitting ? "Please wait…" : "Verify & Check In/Out"}
              </button>
            </form>
          )}

          {phase === "error" && (
            <button
              type="button"
              className="primary-btn primary-btn--wide"
              onClick={() => {
                const t = window.localStorage.getItem(DEVICE_TOKEN_KEY);
                if (t && location) runScan(t, location);
                else goToLogin();
              }}
            >
              Try again
            </button>
          )}

          {(phase === "success" || phase === "error") && (
            <button type="button" className="portal-switch" onClick={goToLogin}>
              Back to login
            </button>
          )}

          {(phase === "success" || phase === "error") && (
            <button type="button" className="portal-switch" onClick={handleUseDifferentAccount}>
              Not you? Use a different account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Opens the phone's own camera straight away (via html5-qrcode, the
// library named in the FYP proposal's tech stack) to read an entrance
// poster QR — used whenever /curfew is opened without a location already
// known, so scanning starts immediately instead of behind a click.
function QrCameraScanner({ onDecoded }) {
  const containerId = "curfew-qr-reader";
  const scannerRef = useRef(null);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    let cancelled = false;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decodedText) => {
            let loc = "Main Entrance";
            try {
              loc = new URL(decodedText).searchParams.get("loc") || loc;
            } catch {
              // Not a full URL — treat the raw scanned text as the location.
              loc = decodedText;
            }
            scanner.stop().catch(() => {});
            onDecoded(loc);
          },
          () => {
            /* per-frame "no QR found yet" — expected, ignore */
          }
        )
        .catch((err) =>
          setScanError(
            "Couldn't open the camera. Make sure you allowed camera access, and that you're on https:// or localhost. (" +
              err +
              ")"
          )
        );
    });

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <div className="scrim" />
      <div className="container">
        <div className="card">
          <img src="/logo.png" alt="" className="avatar" aria-hidden="true" />
          <p className="brand-name">DormSphere</p>
          <h1 className="title">Scan Entrance QR</h1>
          <p className="tab__subtitle-text">Point your camera at the poster QR by the door.</p>

          {scanError && (
            <p className="message message--error" role="alert">
              {scanError}
            </p>
          )}
          <div id={containerId} style={{ width: "100%", borderRadius: "16px", overflow: "hidden" }} />

          <button type="button" className="portal-switch" onClick={() => onDecoded("Main Entrance")}>
            Skip scanning (Main Entrance)
          </button>
          <button type="button" className="portal-switch" onClick={goToLogin}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

export default CurfewScanPage;