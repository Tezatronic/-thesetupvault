// Deliberately duplicated from generate-post.mjs rather than imported.
// The Demand Engine must be fully decoupled from the existing publishing
// pipeline (per the Phase 1 brief) — sharing this tiny client via import
// would create a coupling point that doesn't need to exist. If this file
// ever needs to change, it changes independently of the live publisher.

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 8000;
const MAX_DELAY_MS = 60000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.3 }
        })
      });
    } catch (networkErr) {
      lastError = new Error(`Gemini fetch failed: ${networkErr.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
        console.warn(`[demand-engine] Gemini attempt ${attempt}/${MAX_ATTEMPTS} failed (network). Retrying in ${delay / 1000}s...`);
        await sleep(delay);
        continue;
      }
      throw lastError;
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned no text content');
      return text;
    }

    const errText = await res.text();
    lastError = new Error(`Gemini API error ${res.status}: ${errText}`);

    const isRetryable = RETRYABLE_STATUS_CODES.has(res.status);
    if (!isRetryable || attempt === MAX_ATTEMPTS) throw lastError;

    const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
    console.warn(`[demand-engine] Gemini attempt ${attempt}/${MAX_ATTEMPTS} failed (HTTP ${res.status}). Retrying in ${delay / 1000}s...`);
    await sleep(delay);
  }
  throw lastError;
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.3
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned no text content');
  return text;
}

export async function callAI(prompt) {
  try {
    return await callGemini(prompt);
  } catch (geminiErr) {
    console.warn(`[demand-engine] Gemini failed after all retries: ${geminiErr.message}`);
    console.warn('[demand-engine] Falling back to Groq...');
    try {
      return await callGroq(prompt);
    } catch (groqErr) {
      throw new Error(`Both providers failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`);
    }
  }
}
