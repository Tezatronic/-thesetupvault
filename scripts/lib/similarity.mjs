// Duplicated from generate-post.mjs's dynamic-angle similarity check, for
// the same decoupling reason as ai-client.mjs. Same tokenizer, same
// threshold philosophy (favor false rejections over false acceptances).
//
// *** ARCHITECTURAL NOTE — READ BEFORE TOUCHING SIMILARITY_REJECT_THRESHOLD ***
// This code-side check is a CHEAP PRELIMINARY GUARD ONLY. It exists to catch
// obvious, high-overlap duplicates without spending an AI call. It is NOT,
// and must never become, the authority on semantic duplication.
//
// Why: a short PAA question and a long existing article/angle description
// can be semantically identical while sharing very few tokens. Confirmed
// case from real pilot testing — "Does a laptop stand help reduce
// overheating?" against the real, already-published "laptop-stand-cooling-
// benefits" angle (a long focus+keywords string about heat dissipation)
// scored only ~0.14 Jaccard similarity, nowhere near this threshold, despite
// asking the exact same thing. Word-overlap scoring cannot solve semantic
// duplication by itself, no matter how the threshold below is tuned.
//
// The actual authority on "has this already been covered?" is the AI filter
// in demand-research.mjs's buildFilterPrompt(), which is given the cluster's
// existing titles/angles directly as context and asked to judge meaning, not
// just wording. Do NOT try to fix a semantic-duplicate miss by lowering this
// threshold — that will only increase false rejections of genuinely distinct
// short questions elsewhere, without closing the semantic gap it can't see.
// If duplicates are still slipping through, the fix is in the AI prompt's
// coverage context, not here.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'vs',
  'your', 'you', 'is', 'are', 'best', 'guide', 'how', 'what', 'which', 'do',
  'does', 'it', 'this', 'that', 'at', 'desk', 'setup', 'home', 'office'
]);

export function tokenize(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  );
}

export function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const SIMILARITY_REJECT_THRESHOLD = 0.34;
