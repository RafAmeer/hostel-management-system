import { supabase } from "./supabaseClient.js";

// One place that calls a Supabase Edge Function and turns every failure into
// a message a person (or you, while debugging) can act on.
//
// Why: supabase-js reports a blocked/unreachable function as the vague
// "Failed to send a request to the Edge Function". That one message hides at
// least four very different problems:
//   - the function was never deployed (gateway answers 404)
//   - it was deployed WITH JWT verification, so the gateway rejects the
//     request before our code runs (and sends no CORS headers, so the
//     browser shows it as a network error) — fix: --no-verify-jwt, now also
//     pinned in supabase/config.toml
//   - the project is offline / the phone has no signal
//   - the function itself crashed (we return its own JSON error text)
const DEFAULT_TIMEOUT_MS = 25000;

export async function callFunction(name, body = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let result;
  try {
    result = await supabase.functions.invoke(name, { body, timeout: timeoutMs });
  } catch (err) {
    // invoke() normally returns { error }, but guard against a throw too.
    throw new Error(describeNetworkFailure(name, err), { cause: err });
  }

  const { data, error } = result;
  if (error) {
    if (error.name === "FunctionsHttpError") {
      let detail = "";
      let status = error.context?.status;
      try {
        const j = await error.context.clone().json();
        detail = j?.error || j?.message || "";
      } catch {
        try {
          detail = (await error.context.text()).slice(0, 200);
        } catch {
          /* no body */
        }
      }
      if (status === 404 && /not.?found/i.test(detail)) {
        throw new Error(`The "${name}" edge function isn't deployed on this Supabase project yet.`);
      }
      if (status === 401 && /jwt/i.test(detail)) {
        throw new Error(
          `The "${name}" edge function rejected the request (invalid JWT). Redeploy it: supabase functions deploy ${name} --no-verify-jwt`
        );
      }
      throw new Error(detail || `The "${name}" edge function returned an error${status ? ` (${status})` : ""}.`);
    }
    if (error.name === "FunctionsRelayError") {
      throw new Error(`Supabase couldn't start the "${name}" edge function. Check its logs in the dashboard.`);
    }
    throw new Error(describeNetworkFailure(name, error));
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function describeNetworkFailure(name, err) {
  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return `The "${name}" edge function took too long to answer. Please try again.`;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "You appear to be offline. Check your connection and try again.";
  }
  return (
    `Couldn't reach the "${name}" edge function. It is either not deployed, or it was deployed with JWT ` +
    `verification on. Run: supabase functions deploy ${name} --no-verify-jwt`
  );
}
