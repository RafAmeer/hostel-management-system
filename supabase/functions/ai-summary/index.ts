// Supabase Edge Function: ai-summary
//
// Two modes, both grounded in the same client-computed `stats` object
// (occupancy/bookings/complaints/curfew/registration) from the Warden
// dashboard — Gemini never sees raw database rows and never computes a
// number itself:
//   1. Chat mode  — body has `question` (+ `stats`): answers ONE specific
//      question the warden typed or picked from a suggested-question chip,
//      in 1-3 sentences. This is what the "AI Assistant" chat panel uses.
//   2. Report mode — body has only `stats` (no `question`, kept for
//      backwards compatibility): writes the old fixed 3-5 sentence report.
// The Gemini API key lives only here as a Supabase secret — it is never
// sent to the browser.
//
// Deploy:
//   supabase functions deploy ai-summary
// (supabase/config.toml sets verify_jwt = false; this function checks the
// caller's token itself below.)
// Set the secret once (get a free key at https://aistudio.google.com/apikey):
//   supabase secrets set GEMINI_API_KEY=your-key-here

import { createClient } from "jsr:@supabase/supabase-js@2";

// Tried in order until one answers. Optional secret GEMINI_MODEL puts your
// own choice first (supabase secrets set GEMINI_MODEL=...). A model that was
// retired or renamed (404) used to make the whole assistant fail with
// "Gemini API error"; now the next one is tried automatically.
const GEMINI_MODELS = [
  Deno.env.get("GEMINI_MODEL"),
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
].filter((m, i, all): m is string => Boolean(m) && all.indexOf(m) === i);

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Only logged-in wardens should be able to call this. Verify the
    // caller's Supabase auth token before spending any Gemini quota on them.
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

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return jsonResponse({ error: "GEMINI_API_KEY secret is not set" }, 500);
    }

    const prompt = question ? buildQuestionPrompt(question, stats) : buildPrompt(stats);

    const callGemini = (model: string, withThinkingConfig: boolean) =>
      fetch(geminiUrl(model), {
        method: "POST",
        // Key in a header (not the URL) so it never ends up in logs.
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // 400 was enough for one question, but a warden asking two
          // questions in one message needs room for two short answers, and
          // some models spend part of maxOutputTokens on internal "thinking"
          // before the visible answer, which left too little headroom and
          // made Gemini return an empty candidate (finishReason MAX_TOKENS).
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 800,
            ...(withThinkingConfig ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      });

    let geminiRes: Response | null = null;
    let lastError = "";
    for (const model of GEMINI_MODELS) {
      let res = await callGemini(model, true);
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
      // 404 = model not available to this key; 429/5xx = try the next one too.
      if (res.status === 401 || res.status === 403) break;
    }

    if (!geminiRes) {
      return jsonResponse({ error: `Gemini API error: ${lastError || "no model answered"}` }, 502);
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData?.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      // No visible text at all — log why so it's debuggable from the
      // function logs instead of just showing the generic fallback.
      console.error(
        "ai-summary: empty candidate",
        JSON.stringify({ finishReason: candidate?.finishReason, promptFeedback: geminiData?.promptFeedback })
      );
      if (candidate?.finishReason === "SAFETY" || geminiData?.promptFeedback?.blockReason) {
        return jsonResponse({ error: "That question couldn't be answered — try rephrasing it." }, 502);
      }
      return jsonResponse(
        { error: "The AI assistant didn't return an answer — please try asking again." },
        502
      );
    }

    let summary = rawText;

    // Safety net: even with a higher token budget, never show the warden a
    // sentence fragment. If Gemini still got cut off, trim back to the last
    // full sentence instead of ending mid-word.
    if (candidate?.finishReason === "MAX_TOKENS") {
      console.warn("ai-summary: Gemini response was truncated by maxOutputTokens");
      const lastStop = Math.max(
        summary.lastIndexOf(". "),
        summary.lastIndexOf("! "),
        summary.lastIndexOf("? ")
      );
      if (lastStop > 0) summary = summary.slice(0, lastStop + 1);
    }

    return question ? jsonResponse({ answer: summary }) : jsonResponse({ summary });
  } catch (err) {
    console.error("ai-summary unexpected error:", err);
    return jsonResponse({ error: String(err) }, 500);
  }
});

function buildPrompt(stats: Record<string, unknown>) {
  return [
    "You are writing a short AI-assisted analytics report for a hostel warden dashboard. ",
    "Every number below — totals, category breakdowns, period-over-period trend percentages, and the date range — ",
    "has already been computed correctly from the database. Do NOT recompute, round differently, guess, or invent ",
    "any figure that is not present in the JSON. Your only job is to turn this data into a clear report of 3-5 short ",
    "sentences, plain prose, no bullet points or headers, that:\n",
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
    "1. Answer ONLY the question(s) asked, in plain prose. No bullet points, no headers, no restating the whole ",
    "dataset. If the warden asked a single question, answer in 1-3 short sentences. If the message actually ",
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

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
