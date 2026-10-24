// Supabase Edge Function: ai-summary
//
// Two modes, both grounded in the same client-computed `stats` object
// (occupancy/bookings/complaints/curfew/registration) from the Warden
// dashboard — the AI never sees raw database rows and never computes a
// number itself:
//   1. Chat mode  — body has `question` (+ `stats`): answers ONE specific
//      question the warden typed or picked from a suggested-question chip,
//      in 1-3 sentences. This is what the "AI Assistant" chat panel uses.
//   2. Report mode — body has only `stats` (no `question`, kept for
//      backwards compatibility): writes the old fixed 3-5 sentence report.
//
// AI providers — tried in this order, each one only if its key is set:
//   1. Groq   (GROQ_API_KEY)      — free tier, very fast. Main provider.
//   2. Claude (ANTHROPIC_API_KEY) — optional, paid. Not used unless you add a key.
//   3. Gemini (GEMINI_API_KEY)    — optional free backup.
// If one provider is busy or down, the next one answers instead, so the
// warden still gets a reply. API keys live only here as Supabase secrets —
// never sent to the browser.
//
// Deploy:
//   supabase functions deploy ai-summary
// (supabase/config.toml sets verify_jwt = false; this function checks the
// caller's token itself below.)
// Set the main secret once (free key at https://console.groq.com/keys):
//   supabase secrets set GROQ_API_KEY=your-key-here
// Optional:
//   supabase secrets set GROQ_MODEL=...                    (put your own Groq model first)
//   supabase secrets set GEMINI_API_KEY=your-key-here      (free backup provider)
//   supabase secrets set ANTHROPIC_API_KEY=your-key-here   (Claude, paid)
//   supabase secrets set CLAUDE_MODEL=claude-haiku-5-5

import { createClient } from "jsr:@supabase/supabase-js@2";

// ---------- Groq config (main provider, OpenAI-compatible API) ----------
// Tried in order. Each model has its own free-tier rate limit, so if the
// 70B model is rate-limited the smaller 8B model usually still answers.
const GROQ_MODELS = [
  Deno.env.get("GROQ_MODEL"),
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i);

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// ---------- Claude config (optional, paid) ----------
// Tried in order. Haiku is fast and cheap — ideal for short summaries.
// Sonnet is the backup if Haiku is overloaded.
const CLAUDE_MODELS = [
  Deno.env.get("CLAUDE_MODEL"),
  "claude-haiku-5-5",
  "claude-sonnet-5-5",
].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i);

const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
// How many times to retry the SAME model on a temporary error (429 rate
// limit, 529 overloaded, 5xx) before moving to the next model.
const RETRIES_PER_MODEL = 2;

// ---------- Gemini config (optional backup) ----------
const GEMINI_MODELS = [
  Deno.env.get("GEMINI_MODEL"),
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i);

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const MAX_OUTPUT_TOKENS = 800;

// Time budget so all the retries still finish before the browser gives up
// (the frontend waits 40s). Each provider must finish by its deadline,
// measured from the start of the request.
const GROQ_DEADLINE_MS = 18000;
const CLAUDE_DEADLINE_MS = 26000;
const TOTAL_BUDGET_MS = 34000;
const PER_CALL_TIMEOUT_MS = 15000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AiResult = { text: string; truncated: boolean; provider: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only logged-in wardens should be able to call this. Verify the
    // caller's Supabase auth token before spending any AI quota on them.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    const { stats, question } = await req.json();
    if (!stats) {
      return jsonResponse({ error: "Missing `stats` in request body" }, 400);
    }

    const groqKey = Deno.env.get("GROQ_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!groqKey && !anthropicKey && !geminiKey) {
      return jsonResponse({ error: "GROQ_API_KEY secret is not set" }, 500);
    }

    const prompt = question ? buildQuestionPrompt(question, stats) : buildPrompt(stats);
    const startedAt = Date.now();

    // Groq first, then Claude (if a key is set), then Gemini as last backup.
    let result: AiResult | null = null;
    const errors: string[] = [];

    if (groqKey) {
      try {
        result = await generateWithGroq(prompt, groqKey, startedAt + GROQ_DEADLINE_MS);
      } catch (err) {
        errors.push(`Groq: ${err instanceof Error ? err.message : String(err)}`);
        console.error("ai-summary: Groq failed:", err);
      }
    }

    if (!result && anthropicKey) {
      try {
        result = await generateWithClaude(prompt, anthropicKey, startedAt + CLAUDE_DEADLINE_MS);
      } catch (err) {
        errors.push(`Claude: ${err instanceof Error ? err.message : String(err)}`);
        console.error("ai-summary: Claude failed:", err);
      }
    }

    if (!result && geminiKey) {
      try {
        result = await generateWithGemini(prompt, geminiKey, startedAt + TOTAL_BUDGET_MS);
      } catch (err) {
        errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`);
        console.error("ai-summary: Gemini failed:", err);
      }
    }

    if (!result) {
      // Keep the warden-facing message friendly; full detail is in the logs.
      console.error("ai-summary: all providers failed:", errors.join(" | "));
      const safetyBlocked = errors.some((e) => /SAFETY_BLOCKED/.test(e));
      return jsonResponse(
        {
          error: safetyBlocked
            ? "That question couldn't be answered — try rephrasing it."
            : "The AI assistant is busy right now — please try again in a moment.",
        },
        502
      );
    }

    let summary = result.text;

    // Safety net: never show the warden a sentence fragment. If the answer
    // got cut off by the token limit, trim back to the last full sentence.
    if (result.truncated) {
      console.warn(`ai-summary: ${result.provider} response was truncated by the token limit`);
      const lastStop = Math.max(
        summary.lastIndexOf(". "),
        summary.lastIndexOf("! "),
        summary.lastIndexOf("? ")
      );
      if (lastStop > 0) summary = summary.slice(0, lastStop + 1);
    }

    return question
      ? jsonResponse({ answer: summary, provider: result.provider })
      : jsonResponse({ summary, provider: result.provider });
  } catch (err) {
    console.error("ai-summary unexpected error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

// ---------------------------------------------------------------------------
// Groq (OpenAI-compatible chat completions API)
// ---------------------------------------------------------------------------
async function generateWithGroq(prompt: string, apiKey: string, deadline: number): Promise<AiResult> {
  let lastError = "";

  outer: for (const model of GROQ_MODELS) {
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      if (attempt > 0) await sleep(700 * attempt); // 0.7s, then 1.4s
      const remaining = deadline - Date.now();
      if (remaining < 3000) {
        lastError ||= "out of time";
        break outer;
      }

      let res: Response;
      try {
        res = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: AbortSignal.timeout(Math.min(PER_CALL_TIMEOUT_MS, remaining)),
          body: JSON.stringify({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.4,
            messages: [{ role: "user", content: prompt }],
          }),
        });
      } catch (err) {
        // Timeout / network blip — retry.
        lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const choice = data?.choices?.[0];
        const text = (choice?.message?.content ?? "").trim();
        if (!text) {
          if (choice?.finish_reason === "content_filter") throw new Error("SAFETY_BLOCKED");
          lastError = `${model}: empty response (finish_reason ${choice?.finish_reason})`;
          continue;
        }
        return { text, truncated: choice?.finish_reason === "length", provider: "groq" };
      }

      const errText = await res.text();
      lastError = `${model}: ${res.status} ${errText.slice(0, 300)}`;
      console.error("Groq API error:", lastError);

      // Bad key: retrying won't help.
      if (res.status === 401 || res.status === 403) throw new Error(lastError);
      // Model retired / not available, or bad request for this model — next model.
      if (res.status === 400 || res.status === 404) break;
      // 429 on the free tier usually means this model's daily/minute quota is
      // used up — move straight to the next model (it has its own quota).
      if (res.status === 429) break;
      // 5xx / 503 over capacity: loop retries the same model.
    }
  }

  throw new Error(lastError || "no Groq model answered");
}

// ---------------------------------------------------------------------------
// Claude (Anthropic Messages API) — optional, only used if ANTHROPIC_API_KEY is set
// ---------------------------------------------------------------------------
async function generateWithClaude(prompt: string, apiKey: string, deadline: number): Promise<AiResult> {
  let lastError = "";

  outer: for (const model of CLAUDE_MODELS) {
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      if (attempt > 0) await sleep(700 * attempt); // 0.7s, then 1.4s
      const remaining = deadline - Date.now();
      if (remaining < 3000) {
        lastError ||= "out of time";
        break outer;
      }

      let res: Response;
      try {
        res = await fetch(CLAUDE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          signal: AbortSignal.timeout(Math.min(PER_CALL_TIMEOUT_MS, remaining)),
          body: JSON.stringify({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.4,
            messages: [{ role: "user", content: prompt }],
          }),
        });
      } catch (err) {
        // Timeout / network blip — retry.
        lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        const text = (data?.content ?? [])
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("")
          .trim();

        if (!text) {
          if (data?.stop_reason === "refusal") throw new Error("SAFETY_BLOCKED");
          lastError = `${model}: empty response (stop_reason ${data?.stop_reason})`;
          continue;
        }
        return { text, truncated: data?.stop_reason === "max_tokens", provider: "claude" };
      }

      const errText = await res.text();
      lastError = `${model}: ${res.status} ${errText.slice(0, 300)}`;
      console.error("Claude API error:", lastError);

      // Bad key / no credits: retrying won't help.
      if (res.status === 401 || res.status === 403) throw new Error(lastError);
      if (res.status === 400) {
        if (/credit balance/i.test(errText)) throw new Error(lastError);
        break; // something about this model/request — try the next model
      }
      if (res.status === 404) break; // model not available — next model
      // 429 (rate limit), 529 (overloaded), 5xx: loop retries the same model.
    }
  }

  throw new Error(lastError || "no Claude model answered");
}

// ---------------------------------------------------------------------------
// Gemini (optional backup) — same behaviour as the original implementation
// ---------------------------------------------------------------------------
async function generateWithGemini(prompt: string, apiKey: string, deadline: number): Promise<AiResult> {
  const callGemini = (model: string, withThinkingConfig: boolean) =>
    fetch(geminiUrl(model), {
      method: "POST",
      // Key in a header (not the URL) so it never ends up in logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(Math.max(1000, Math.min(PER_CALL_TIMEOUT_MS, deadline - Date.now()))),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          ...(withThinkingConfig ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });

  let geminiRes: Response | null = null;
  let lastError = "";
  for (const model of GEMINI_MODELS) {
    if (deadline - Date.now() < 3000) break; // out of time
    let res: Response;
    try {
      res = await callGemini(model, true);
    } catch (err) {
      lastError = `${model}: ${err instanceof Error ? err.message : String(err)}`;
      continue; // timeout / network blip — try the next model
    }
    if (res.status === 400) {
      // Some models refuse thinkingBudget: 0. Retry the same model without it.
      const t = await res.text();
      if (/thinking/i.test(t)) res = await callGemini(model, false);
      else {
        lastError = `${model}: ${t}`;
        if (/API key/i.test(t)) break; // a bad key will fail on every model
        continue;
      }
    }
    if (res.ok) {
      geminiRes = res;
      break;
    }
    const errText = await res.text();
    lastError = `${model}: ${res.status} ${errText}`;
    console.error("Gemini API error:", lastError);
    if (res.status === 401 || res.status === 403) break;
  }

  if (!geminiRes) throw new Error(lastError || "no Gemini model answered");

  const geminiData = await geminiRes.json();
  const candidate = geminiData?.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    if (candidate?.finishReason === "SAFETY" || geminiData?.promptFeedback?.blockReason) {
      throw new Error("SAFETY_BLOCKED");
    }
    throw new Error(`empty candidate (finishReason ${candidate?.finishReason})`);
  }
  return { text, truncated: candidate?.finishReason === "MAX_TOKENS", provider: "gemini" };
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
function buildPrompt(stats: Record<string, unknown>) {
  return [
    "You are writing a short AI-assisted analytics report for a hostel warden dashboard. ",
    "Every number below — totals, category breakdowns, period-over-period trend percentages, and the date range — ",
    "has already been computed correctly from the database. Do NOT recompute, round differently, guess, or invent ",
    "any figure that is not present in the JSON. Your only job is to turn this data into a clear report of 3-5 short ",
    "sentences, plain prose, no bullet points, headers or markdown, that:\n",
    "1. States the date range the report covers.\n",
    "2. Summarizes the key totals (bookings, complaints, students currently out, overdue curfews).\n",
    "3. Names the top complaint category and its count.\n",
    "4. States the trend vs the previous period for bookings and complaints (up/down/flat, using the given pctChange values).\n",
    "5. Flags anything that genuinely needs the warden's attention right now — or says things look normal if nothing stands out.\n",
    "Here is the aggregated data as JSON:\n\n",
    JSON.stringify(stats, null, 2),
  ].join("");
}

function buildQuestionPrompt(question: string, stats: Record<string, unknown>) {
  return [
    "You are a hostel-management chat assistant for a warden. The warden just asked you a specific question. ",
    "Every number in the JSON below has already been computed correctly from the database — totals, room ",
    "occupancy, registered-student counts, category breakdowns, and period-over-period trends. ",
    "Do NOT recompute, round differently, guess, or invent any figure that is not present in the JSON.\n\n",
    "Rules:\n",
    "1. Answer ONLY the question(s) asked, in plain prose. No bullet points, headers or markdown, and no restating ",
    "the whole dataset. If the warden asked a single question, answer in 1-3 short sentences. If the message actually ",
    "contains two or more separate questions (e.g. joined with \"and\", or a list), answer EACH one in turn, ",
    "1-2 sentences per question, in the order they were asked — never skip a question or merge them into one ",
    "vague answer.\n",
    "2. If an answer requires a number, quote it exactly as it appears in the JSON (or a value directly ",
    "derivable from it, e.g. a simple sum or percentage of two given numbers).\n",
    "3. If the JSON genuinely does not contain enough information to answer part of the question, say so plainly ",
    "for that part instead of guessing — do not make up a number or claim data you don't have.\n",
    "4. Keep the tone plain and factual, the way a colleague would answer over chat.\n\n",
    `Warden's question: "${question}"\n\n`,
    "Here is the aggregated hostel data as JSON:\n\n",
    JSON.stringify(stats, null, 2),
  ].join("");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
