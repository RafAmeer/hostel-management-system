import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Public route: /curfew?loc=Main%20Entrance
//
// This page is reached WITHOUT logging in — either by scanning a poster QR
// at the entrance with the phone's own camera app (which just opens this
// URL), or via the in-page camera scanner below for demoing without a
// printed poster. See supabase/migrations/2026-09-27_curfew_device_binding.sql
// and supabase/functions/curfew-scan for the server side of this flow.
const DEVICE_TOKEN_KEY = "dormsphere_curfew_device_token";

function readLocationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("loc") || "Main Entrance";
}

async function callCurfewScan(deviceToken, location) {
  const { data, error } = await supabase.functions.invoke("curfew-scan", {
    body: { device_token: deviceToken, location },
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
  const [location, setLocation] = useState(readLocationFromUrl);
  // "checking" | "binding" | "scanning" | "success" | "error"
  const [phase, setPhase] = useState("checking");
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const ranOnce = useRef(false);

  const runScan = async (deviceToken) => {
    setPhase("scanning");
    try {
      const data = await callCurfewScan(deviceToken, location);
      setResult(data);
      setPhase("success");
    } catch (err) {
      if (err.message === "device_not_recognized") {
        window.localStorage.removeItem(DEVICE_TOKEN_KEY);
        setPhase("binding");
      } else {
        setErrorMessage(err.message);
        setPhase("error");
      }
    }
  };

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;
    const savedToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (savedToken) {
      runScan(savedToken);
    } else {
      setPhase("binding");
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
    await runScan(deviceToken);
  };

  const handleUseDifferentAccount = () => {
    window.localStorage.removeItem(DEVICE_TOKEN_KEY);
    setResult(null);
    setErrorMessage("");
    setPhase("binding");
  };

  const handleScannedLocation = (scannedLoc) => {
    setShowScanner(false);
    setLocation(scannedLoc);
    const savedToken = window.localStorage.getItem(DEVICE_TOKEN_KEY);
    if (savedToken) runScan(savedToken);
    else setPhase("binding");
  };

  return (
    <div className="page">
      <div className="scrim" />
      <div className="container">
        <div className="card">
          <img src="/logo.png" alt="" className="avatar" aria-hidden="true" />
          <p className="brand-name">DormSphere</p>
          <h1 className="title">Curfew Check-In</h1>
          <p className="subtitle">{location}</p>

          {phase === "checking" && <p className="tab__message">Checking this device…</p>}

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

          {(phase === "success" || phase === "error") && (
            <button type="button" className="portal-switch" onClick={handleUseDifferentAccount}>
              Not you? Use a different account
            </button>
          )}

          {phase === "binding" && !showScanner && readLocationFromUrl() === "Main Entrance" && (
            <button type="button" className="portal-switch" onClick={() => setShowScanner(true)}>
              Scan the entrance QR instead
            </button>
          )}

          {showScanner && <QrCameraScanner onDecoded={handleScannedLocation} onClose={() => setShowScanner(false)} />}
        </div>
      </div>
    </div>
  );
}

// Camera-based fallback for when this page was opened directly (e.g. typed
// in, or during a demo) instead of via a scanned poster link — reads a
// poster QR with the phone's own browser camera using html5-qrcode, the
// library named in the FYP proposal's tech stack.
function QrCameraScanner({ onDecoded, onClose }) {
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
          { fps: 10, qrbox: 220 },
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
        .catch((err) => setScanError("Couldn't open the camera: " + err));
    });

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-panel" style={{ marginTop: "1rem" }}>
      {scanError && (
        <p className="message message--error" role="alert">
          {scanError}
        </p>
      )}
      <div id={containerId} style={{ width: "100%" }} />
      <button type="button" className="portal-switch" onClick={onClose}>
        Cancel
      </button>
    </div>
  );
}

export default CurfewScanPage;
