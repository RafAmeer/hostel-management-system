import { supabase } from "./supabaseClient.js";

// Calls the `ai-summary` Supabase Edge Function in "question" mode: instead
// of always writing a fixed multi-sentence report, the warden can ask any
// specific question ("how many students are registered?") and get a short
// direct answer grounded only in the `stats` object already computed on
// the client (see lib/analytics.js). The model never sees raw database
// rows and is told not to invent numbers that aren't in `stats`.
export async function askHostelAssistant(question, stats) {
  const { data, error } = await supabase.functions.invoke("ai-summary", {
    body: { question, stats },
  });

  if (error) {
    let message = error.message ?? "Failed to reach the AI assistant";
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

  return data.answer ?? data.summary;
}
