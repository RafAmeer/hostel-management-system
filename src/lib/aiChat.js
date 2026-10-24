import { callFunction } from "./callFunction.js";

// Calls the `ai-summary` Supabase Edge Function in "question" mode: instead
// of always writing a fixed multi-sentence report, the warden can ask any
// specific question ("how many students are registered?") and get a short
// direct answer grounded only in the `stats` object already computed on
// the client (see lib/analytics.js). The model never sees raw database
// rows and is told not to invent numbers that aren't in `stats`.
//
// Answer cache: every successful answer is saved in localStorage. If the AI
// can't be reached (busy, offline, out of credits), the last saved answer
// for the same question is shown instead of an error, with a short note that
// it's a saved answer. Keeps the assistant usable during a live demo.

const CACHE_KEY = "hostel-ai-answer-cache-v1";
const MAX_CACHED = 50;

export async function askHostelAssistant(question, stats) {
  const key = normalize(question);
  const statsHash = hashStats(stats);

  try {
    const data = await callFunction("ai-summary", { question, stats }, { timeoutMs: 40000 });
    const answer = data?.answer ?? data?.summary;
    if (answer) saveAnswer(key, statsHash, answer);
    return answer;
  } catch (err) {
    const cached = loadAnswer(key);
    if (cached) {
      const note =
        cached.statsHash === statsHash
          ? "(Saved answer — the AI assistant is busy right now.)"
          : `(Saved answer from ${formatTime(cached.savedAt)} — the AI assistant is busy right now, so the figures may have changed since then.)`;
      return `${cached.answer} ${note}`;
    }
    throw err;
  }
}

function normalize(q) {
  return q.trim().toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
}

// Small fast hash so we can tell whether the data behind a saved answer
// is the same as now.
function hashStats(stats) {
  const s = JSON.stringify(stats ?? {});
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAnswer(key, statsHash, answer) {
  try {
    const cache = readCache();
    cache[key] = { answer, statsHash, savedAt: Date.now() };
    // Keep only the newest entries.
    const entries = Object.entries(cache).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, MAX_CACHED);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* storage full or blocked — caching is best-effort */
  }
}

function loadAnswer(key) {
  return readCache()[key] ?? null;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "earlier";
  }
}
