// Provider abstraction: this is the ONLY thing that knows SerpApi's request/
// response shape. demand-research.mjs calls fetchRelatedQuestions() and gets
// back a normalized array — swapping in a future Search Console or Trends
// provider means writing a new file with the same export, not touching the
// research/filter logic at all.
//
// Uses SerpApi's standard `engine=google` search, which returns Google's
// "People Also Ask" block inline as `related_questions` — no need for the
// separate google_related_questions engine (that one's for paginating
// *beyond* the first PAA batch via next_page_token, which Phase 1 doesn't
// need at this seed-query scale).

const SERPAPI_BASE = 'https://serpapi.com/search.json';

export const providerName = 'serpapi';

// Returns [] on any failure (missing key, network error, bad response,
// empty related_questions) rather than throwing — callers should still
// wrap this defensively, but this provider itself never crashes a research
// run over one bad seed query.
export async function fetchRelatedQuestions(seedQuery, market) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.warn('[serpapi-provider] SERPAPI_KEY is not set — skipping.');
    return [];
  }

  const params = new URLSearchParams({
    engine: 'google',
    q: seedQuery,
    gl: market.toLowerCase(),
    hl: 'en',
    num: '10',
    api_key: apiKey
  });

  let res;
  try {
    res = await fetch(`${SERPAPI_BASE}?${params.toString()}`);
  } catch (networkErr) {
    console.warn(`[serpapi-provider] Network error for "${seedQuery}": ${networkErr.message}`);
    return [];
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[serpapi-provider] HTTP ${res.status} for "${seedQuery}": ${body.slice(0, 300)}`);
    return [];
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.warn(`[serpapi-provider] Malformed JSON for "${seedQuery}": ${parseErr.message}`);
    return [];
  }

  if (data?.search_metadata?.status === 'Error') {
    console.warn(`[serpapi-provider] SerpApi error for "${seedQuery}": ${data.error || 'unknown error'}`);
    return [];
  }

  const related = Array.isArray(data?.related_questions) ? data.related_questions : [];
  return related
    .filter(r => typeof r?.question === 'string' && r.question.trim().length > 0)
    .map(r => ({
      question: r.question.trim(),
      snippet: typeof r.snippet === 'string' ? r.snippet.trim() : null,
      sourceQuery: seedQuery
    }));
}
