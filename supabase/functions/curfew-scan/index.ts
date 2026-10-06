// Supabase Edge Function: curfew-scan
//
// Called from the PUBLIC /curfew page (CurfewScanPage.jsx) — the visitor
// has NO Supabase Auth session at this point, on purpose (that's the whole
// point of the "remembered device" flow). The browser sends only a long
// random device_token it saved in localStorage after a one-time login; it
// never sends a student_id or any credential. This function is the only
// thing that can turn that token into an actual curfew_logs row, because
// it runs with the service-role key server-side (never exposed to the
// browser) and looks the token up in `device_bindings` itself.
//
// Deploy:
//   supabase functions deploy curfew-scan --no-verify-jwt
// --no-verify-jwt is required — this function is meant to be called by
// signed-out visitors, so Supabase must not reject requests for having no
// Authorization header.

import { createClient } from "jsr:@supabase/supabase-js@2";

// Hostel location check, per hostel. Each hostel has its own row in the
// `hostel_locations` table (latitude, longitude, radius_m) which the warden
// fills in from Warden > Curfew ("Set location"). A scan only counts when
// the phone is inside the circle of the hostel whose QR was scanned.
//
// Fallbacks, in order: (1) the hostel's own row, (2) the optional function
// secrets HOSTEL_LAT / HOSTEL_LNG / HOSTEL_RADIUS_M (one shared location),
// (3) no check at all (so the flow still works before anything is set up);
// the coordinates are stored with every scan either way.
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { device_token, location, hostel_id, latitude, longitude, accuracy } = await req.json();
    if (!device_token || typeof device_token !== "string") {
      return jsonResponse({ error: "Missing device_token" }, 400);
    }

    // Phone-only: block obvious desktop browsers server-side too. (The UI
    // already hides the scan on desktop; this stops a hand-made request.)
    const ua = req.headers.get("user-agent") ?? "";
    if (!/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
      return jsonResponse({ error: "phone_only" }, 403);
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return jsonResponse({ error: "location_required" }, 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Work out which circle this phone must be inside.
    let target: { lat: number; lng: number; radius: number } | null = null;

    if (hostel_id || location) {
      let q = supabaseAdmin.from("hostel_locations").select("latitude, longitude, radius_m");
      q = hostel_id ? q.eq("hostel_id", String(hostel_id)) : q.ilike("name", String(location));
      const { data: loc, error: locError } = await q.limit(1).maybeSingle();
      if (locError) console.error("curfew-scan: hostel_locations lookup failed", locError);
      if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
        target = { lat: loc.latitude, lng: loc.longitude, radius: Number(loc.radius_m) || 150 };
      }
    }

    if (!target && Deno.env.get("HOSTEL_LAT") && Deno.env.get("HOSTEL_LNG")) {
      target = {
        lat: Number(Deno.env.get("HOSTEL_LAT")),
        lng: Number(Deno.env.get("HOSTEL_LNG")),
        radius: Number(Deno.env.get("HOSTEL_RADIUS_M") ?? 150) || 150,
      };
    }

    if (target) {
      const dist = distanceMeters(latitude, longitude, target.lat, target.lng);
      // Allow for GPS error: a poor fix (large accuracy) widens the circle a bit.
      const slack = Math.min(Number(accuracy) || 0, 100);
      if (dist > target.radius + slack) {
        return jsonResponse({ error: "outside_hostel_area" }, 403);
      }
    }

    // An unrecognized token (new phone, cleared browser storage, a
    // revoked device) isn't really an "error" the visitor caused — it just
    // means this phone needs the one-time bind step again. The client
    // treats device_not_recognized as "please log in", not a hard failure.
    const { data: binding, error: bindingError } = await supabaseAdmin
      .from("device_bindings")
      .select("student_id")
      .eq("device_token", device_token)
      .maybeSingle();

    if (bindingError) {
      console.error("curfew-scan: binding lookup failed", bindingError);
      return jsonResponse({ error: "Lookup failed" }, 500);
    }
    if (!binding) {
      return jsonResponse({ error: "device_not_recognized" }, 401);
    }

    const studentId = binding.student_id;

    // Same toggle rule as the in-dashboard manual button (CurfewTab.jsx):
    // last scan was a check-out -> this one is a check-in, and vice versa.
    const [{ data: profile }, { data: lastLog }] = await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", studentId).single(),
      supabaseAdmin
        .from("curfew_logs")
        .select("scan_type")
        .eq("student_id", studentId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const nextType = lastLog?.scan_type === "check_out" ? "check_in" : "check_out";
    const timestamp = new Date().toISOString();

    const { error: insertError } = await supabaseAdmin.from("curfew_logs").insert({
      student_id: studentId,
      scan_type: nextType,
      timestamp,
      location: location || hostel_id || "Hostel entrance",
      latitude,
      longitude,
    });

    if (insertError) {
      console.error("curfew-scan: insert failed", insertError);
      return jsonResponse({ error: "Could not log scan" }, 500);
    }

    // Best-effort — a failed "last used" stamp shouldn't fail the scan
    // itself, so this is awaited but not allowed to change the response.
    const { error: touchError } = await supabaseAdmin
      .from("device_bindings")
      .update({ last_used_at: timestamp })
      .eq("device_token", device_token);
    if (touchError) console.error("curfew-scan: last_used_at update failed", touchError);

    return jsonResponse({
      success: true,
      scan_type: nextType,
      student_name: profile?.full_name ?? null,
      timestamp,
    });
  } catch (err) {
    console.error("curfew-scan unexpected error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}