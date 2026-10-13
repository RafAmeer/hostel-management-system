import { callFunction } from "./callFunction.js";

// Calls the `ai-summary` Supabase Edge Function with the current hostel
// stats and returns the generated text. Throws on failure so callers can
// show an error state.
export async function generateHostelSummary(stats) {
  const data = await callFunction("ai-summary", { stats }, { timeoutMs: 40000 });
  return data?.summary;
}
