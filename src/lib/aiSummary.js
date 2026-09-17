import { supabase } from "./supabaseClient.js";

// Calls the `ai-summary` Supabase Edge Function with the current hostel
// stats and returns the generated text. Throws on failure so callers can
// show an error state.
export async function generateHostelSummary(stats) {
  const { data, error } = await supabase.functions.invoke("ai-summary", {
    body: { stats },
  });

  if (error) {
    // supabase-js only gives a generic "non-2xx status code" message here —
    // the actual error text is on the raw Response in `error.context`.
    let message = error.message ?? "Failed to reach the AI summary function";
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch {
      // context wasn't JSON (e.g. a network failure) — fall back to the generic message
    }
    throw new Error(message);
  }
  if (data?.error) {
    throw new Error(data.error);
  }

  return data.summary;
}