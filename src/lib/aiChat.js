import { callFunction } from "./callFunction.js";

// Calls the `ai-summary` Supabase Edge Function in "question" mode: instead
// of always writing a fixed multi-sentence report, the warden can ask any
// specific question ("how many students are registered?") and get a short
// direct answer grounded only in the `stats` object already computed on
// the client (see lib/analytics.js). The model never sees raw database
// rows and is told not to invent numbers that aren't in `stats`.
export async function askHostelAssistant(question, stats) {
  const data = await callFunction("ai-summary", { question, stats }, { timeoutMs: 40000 });
  return data?.answer ?? data?.summary;
}
