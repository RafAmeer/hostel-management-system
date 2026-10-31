// Supabase Edge Function: passkey
//
// Fingerprint / Face / screen-lock sign-in (WebAuthn passkeys).
//   register-options / register-verify : signed-in user adds a passkey
//   login-options / login-verify       : signed-out user proves they hold one;
//                                        returns a one-time token_hash that the
//                                        browser exchanges for a real session
//                                        with supabase.auth.verifyOtp().
//
// Deploy:  supabase functions deploy passkey
// (supabase/config.toml already sets verify_jwt = false for this function:
// login must work signed-out, and register actions check the user's JWT here.)
// Needs the tables from supabase/migrations/2026-10-13_passkey_tables.sql.
// Optional secret PASSKEY_ORIGINS="https://your-app.vercel.app,http://localhost:5173"
// restricts which sites may use this function.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const b64uToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const bytesToB64u = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Quick health check: open /functions/v1/passkey in the browser or call
    // it with {"action":"ping"} to prove the function is deployed and running.
    if (req.method === "GET") return json({ ok: true, function: "passkey" });

    const origin = req.headers.get("origin") ?? "";
    if (!origin) return json({ error: "Missing origin" }, 400);
    const allowed = (Deno.env.get("PASSKEY_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (allowed.length && !allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403);
    const rpID = new URL(origin).hostname;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, response, device_name } = await req.json();
    if (action === "ping") return json({ ok: true, function: "passkey", rpID });

    // Fails loudly if the table is missing (migration not run) instead of
    // silently continuing and later reporting a confusing "Challenge expired".
    const saveChallenge = async (challenge: string, userId: string | null, kind: string) => {
      const { error } = await admin.from("passkey_challenges").insert({ challenge, user_id: userId, kind });
      if (error) {
        throw new Error(
          `Passkey setup is incomplete on the server (${error.message}). Run supabase/migrations/2026-10-13_passkey_tables.sql in the SQL editor.`
        );
      }
    };
    // One-time: fetched and deleted together, and must be under 5 minutes old.
    const takeChallenge = async (challenge: string, kind: string) => {
      const { data } = await admin
        .from("passkey_challenges")
        .delete()
        .eq("challenge", challenge)
        .eq("kind", kind)
        .gt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .select()
        .maybeSingle();
      return data;
    };
    const challengeOf = (r: { response: { clientDataJSON: string } }) =>
      JSON.parse(new TextDecoder().decode(b64uToBytes(r.response.clientDataJSON))).challenge as string;

    // ---------- signed-in: register ----------
    if (action === "register-options" || action === "register-verify") {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: userData } = await admin.auth.getUser(token);
      const user = userData?.user;
      if (!user) return json({ error: "Please sign in first." }, 401);

      if (action === "register-options") {
        const { data: existing } = await admin.from("passkeys").select("id, transports").eq("user_id", user.id);
        const options = await generateRegistrationOptions({
          rpName: "DormSphere",
          rpID,
          userName: user.email ?? user.id,
          userID: new TextEncoder().encode(user.id),
          attestationType: "none",
          excludeCredentials: (existing ?? []).map((c) => ({ id: c.id, transports: c.transports ?? undefined })),
          authenticatorSelection: {
            residentKey: "required", // lets login work without typing an email
            userVerification: "required", // fingerprint / face / PIN every time
            authenticatorAttachment: "platform", // this phone/laptop, not a USB key
          },
        });
        await saveChallenge(options.challenge, user.id, "register");
        return json(options);
      }

      const ch = await takeChallenge(challengeOf(response), "register");
      if (!ch || ch.user_id !== user.id) return json({ error: "Challenge expired. Try again." }, 400);
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!verification.verified || !verification.registrationInfo) return json({ error: "Could not verify." }, 400);
      const { credential } = verification.registrationInfo;
      const { error } = await admin.from("passkeys").insert({
        id: credential.id,
        user_id: user.id,
        public_key: bytesToB64u(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? null,
        device_name: String(device_name ?? "").slice(0, 80) || null,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    // ---------- signed-out: login ----------
    if (action === "login-options") {
      const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
      await saveChallenge(options.challenge, null, "login");
      return json(options);
    }

    if (action === "login-verify") {
      const ch = await takeChallenge(challengeOf(response), "login");
      if (!ch) return json({ error: "Challenge expired. Try again." }, 400);
      const { data: pk, error: pkError } = await admin.from("passkeys").select("*").eq("id", response.id).maybeSingle();
      if (pkError) return json({ error: `Could not look up the passkey: ${pkError.message}` }, 500);
      // The phone still offers a fingerprint whose account (or saved passkey)
      // was deleted. Say so clearly and send the credential id back so the
      // browser can ask the phone's password manager to remove it
      // (WebAuthn Signal API: PublicKeyCredential.signalUnknownCredential).
      const unknown = () =>
        json(
          {
            error:
              "This fingerprint belongs to an account or device that was removed from DormSphere. Sign in with your email and password instead.",
            code: "unknown_credential",
            credential_id: response.id,
          },
          404
        );
      if (!pk) return unknown();

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ch.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: pk.id,
          publicKey: b64uToBytes(pk.public_key),
          counter: Number(pk.counter),
          transports: pk.transports ?? undefined,
        },
        requireUserVerification: true,
      });
      if (!verification.verified) return json({ error: "Could not verify." }, 401);
      await admin.from("passkeys").update({ counter: verification.authenticationInfo.newCounter }).eq("id", pk.id);

      const { data: u } = await admin.auth.admin.getUserById(pk.user_id);
      const email = u?.user?.email;
      if (!email) {
        // Orphaned row (account gone) — clean it up so it can't be used again.
        await admin.from("passkeys").delete().eq("id", pk.id);
        return unknown();
      }
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (linkError || !link?.properties?.hashed_token) return json({ error: "Could not start a session." }, 500);
      // Also send this account's current passkey list so the browser can tell
      // the phone which saved fingerprints are still valid (any others for
      // this account, e.g. ones removed in Profile, get hidden/removed).
      const { data: still } = await admin.from("passkeys").select("id").eq("user_id", pk.user_id);
      return json({
        token_hash: link.properties.hashed_token,
        rp_id: rpID,
        user_handle: bytesToB64u(new TextEncoder().encode(pk.user_id)),
        credential_ids: (still ?? []).map((r) => r.id),
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
