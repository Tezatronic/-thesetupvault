// The Setup Vault — Demand Engine, Phase 1 (pilot).
//
// RESEARCH JOB -> SERP/PAA PROVIDER -> RAW CANDIDATES -> OPPORTUNITY FILTER
// -> OPPORTUNITY POOL (+ ACCEPTED/REJECTED LOGGING)
//
// This script is entirely separate from generate-post.mjs and is NOT run by
// the twice-daily publishing cron — it only runs on manual workflow_dispatch
// (see .github/workflows/demand-research.yml). It never writes blog posts,
// never touches used-angles.json/dynamic-angles.json/dynamic-pointer.json,
// and its failure modes (missing API key, SerpApi down, quota exhausted,
// malformed response) all resolve to "write nothing / log the failure and
// exit 0" — never to a thrown, workflow-failing error. The publishing
// pipeline's Phase 0 opportunity check (in generate-post.mjs) reads whatever
// this script leaves behind purely defensively, so nothing this script does
// can ever block or break normal article publishing.
//
// IMPORTANT: this script only produces opportunities with status "accepted".
// Nothing here is auto-consumable by the publisher. A human reviews the
// batch and promotes individual opportunities to status "ready" using
// scripts/promote-opportunity.mjs — only "ready" opportunities are ever
// picked up by generate-post.mjs. This is the literal implementation of the
// brief's "reviewable batch before scaling" requirement, not just a process
// promise.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { callAI } from './lib/ai-client.mjs';
import { tokenize, jaccardSimilarity, SIMILARITY_REJECT_THRESHOLD } from './lib/similarity.mjs';
import { fetchRelatedQuestions, providerName } from './providers/serpapi-provider.mjs';
import { PILOT_MARKET, PILOT_CLUSTERS, SEED_QUERIES } from './demand-config.mjs';

const PRODUCTS_PATH = path.join('scripts', 'products.json');
const DYNAMIC_ANGLES_PATH = path.join('scripts', 'dynamic-angles.json');
const BLOG_DIR = path.join('src', 'content', 'blog');
const POOL_PATH = path.join('scripts', 'opportunity-pool.json');
const LOG_PATH = path.join('scripts', 'demand-research-log.jsonl');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.warn(`[demand-engine] Could not parse ${filePath}, using fallback: ${err.message}`);
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function logEvent(entry) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  fs.appendFileSync(LOG_PATH, line + '\n');
  console.log(`[demand-engine] ${line}`);
}

// Full history, not the last-25 slice generate-post.mjs uses for prompt
// brevity — this check specifically wants completeness, since the whole
// point is never re-covering something published long ago.
function getAllExistingPostTitles() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const content = fs.readFileSync(path.join(BLOG_DIR, f), 'utf8');
      const match = content.match(/title:\s*(.+)/);
      return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
    })
    .filter(Boolean);
}

function getKnownAnglesForCluster(clusterId, products, dynamicAngles) {
  const cluster = products.find(c => c.cluster === clusterId);
  const staticAngles = cluster ? cluster.angles : [];
  const dynamicForCluster = dynamicAngles[clusterId] || [];
  return [...staticAngles, ...dynamicForCluster].map(a => `${a.focus} ${(a.keywords || []).join(' ')}`);
}

function isTooSimilarToAnything(candidateQuestion, referenceTexts) {
  const candidateTokens = tokenize(candidateQuestion);
  for (const ref of referenceTexts) {
    const sim = jaccardSimilarity(candidateTokens, tokenize(ref));
    if (sim >= SIMILARITY_REJECT_THRESHOLD) {
      return { similarTo: ref, similarity: sim.toFixed(2) };
    }
  }
  return null;
}

function opportunityId(cluster, question) {
  const hash = crypto.createHash('sha1').update(`${cluster}:${question.toLowerCase()}`).digest('hex').slice(0, 10);
  return `${cluster}-${hash}`;
}

function extractJsonObject(raw) {
  let text = raw.trim().replace(/^```(?:json)?\n/, '').replace(/\n```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in filter response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function buildFilterPrompt(cluster, displayName, question, snippet, existingCoverage) {
  // NOTE (GPT review, Phase 1): existingCoverage is currently the FULL set
  // of site-wide post titles + this cluster's known angles, dumped into
  // every single filter call. That's fine at today's scale (a few dozen
  // titles, 9 calls per pilot run) but will not stay cheap as the site
  // grows — eventually this should be trimmed to the current cluster (already
  // is) and/or capped/summarized rather than sent in full. Deliberately not
  // solving that now — premature at pilot scale — but flagging it here so
  // it isn't rediscovered as a surprise later.
  const coverageBlock = existingCoverage.length > 0
    ? `\nCONTENT THIS CLUSTER ALREADY COVERS (published articles + already-used angles — reject or flag if this question substantially overlaps with any of these, even if worded differently):\n${existingCoverage.map(c => `- ${c}`).join('\n')}\n`
    : '\n(No existing content in this cluster yet.)\n';

  return `You are evaluating a real Google "People Also Ask" question as a potential article topic for The Setup Vault, a home-office/desk-setup content site. The site is built around specific desk products, but is not exclusively an affiliate site — it can also publish genuinely useful workspace content that points to its own resources (a planning guide, an email checklist) rather than a product.

CANDIDATE QUESTION: "${question}"
${snippet ? `GOOGLE'S SNIPPET CONTEXT: "${snippet}"\n` : ''}
RELATED PRODUCT CLUSTER: ${displayName}
${coverageBlock}
Evaluate against ALL of these:
A. Brand relevance — is this genuinely about building, planning, organizing, or improving a workspace/desk setup?
B. Search intent — does it show someone wants real guidance, a comparison, troubleshooting help, or planning support (good), versus vague/navigational curiosity (bad)?
C. Existing coverage — does this question ask substantially the same thing as anything listed above, even with different wording or search intent framing? If yes, REJECT with rejectionReason "already_covered" regardless of how good the question otherwise is.
D. Content potential — can this become a genuinely useful, substantial standalone article, or would it only support a thin/generic page?
E. Business relevance — does answering this naturally connect to: an owned Setup Vault product, a free resource/checklist, just useful internal links, or nothing commercial at all? (a "nothing commercial" answer is fine and should not cause rejection by itself if content potential is otherwise high)

If accepting, also suggest 3 short SEO keyword phrases this article should target.

Return ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"decision": "accept" or "reject", "intent": "one short phrase e.g. problem-solving / comparison / planning / troubleshooting", "contentPotential": "high" or "medium" or "low", "businessConnection": "owned_product" or "free_resource" or "internal_link" or "none", "keywords": ["kw1", "kw2", "kw3"], "rejectionReason": "short reason if rejected, else null", "rationale": "one short sentence explaining the decision"}`;
}

async function runResearch() {
  const products = readJson(PRODUCTS_PATH, []);
  const dynamicAngles = readJson(DYNAMIC_ANGLES_PATH, {});
  const existingTitles = getAllExistingPostTitles();
  const pool = readJson(POOL_PATH, []);
  const priorQuestions = pool.map(o => o.question);

  console.log(`[demand-engine] Starting Phase 1 pilot research: market=${PILOT_MARKET}, clusters=${PILOT_CLUSTERS.join(', ')}`);

  let acceptedCount = 0;
  let rejectedCount = 0;
  let seenThisRun = new Set();

  for (const clusterId of PILOT_CLUSTERS) {
    const cluster = products.find(c => c.cluster === clusterId);
    if (!cluster) {
      console.warn(`[demand-engine] Cluster "${clusterId}" not found in products.json — skipping.`);
      continue;
    }

    const seeds = SEED_QUERIES[clusterId] || [];
    const knownAngleTexts = getKnownAnglesForCluster(clusterId, products, dynamicAngles);

    for (const seedQuery of seeds) {
      let candidates;
      try {
        candidates = await fetchRelatedQuestions(seedQuery, PILOT_MARKET);
      } catch (err) {
        // The provider itself already catches its own errors and returns [],
        // but this guards against anything unexpected so one bad seed can
        // never abort the whole research run.
        logEvent({ cluster: clusterId, seedQuery, provider: providerName, error: err.message });
        continue;
      }

      if (candidates.length === 0) {
        logEvent({ cluster: clusterId, seedQuery, provider: providerName, result: 'no_candidates' });
        continue;
      }

      for (const candidate of candidates) {
        const normalized = candidate.question.toLowerCase().trim();
        if (seenThisRun.has(normalized)) continue;
        seenThisRun.add(normalized);

        // Code-side check first — a CHEAP PRELIMINARY GUARD only, not the
        // duplicate-detection authority. It catches obvious high-overlap
        // cases before spending an AI call; it deliberately does NOT decide
        // "already covered" on its own. See scripts/lib/similarity.mjs for
        // why (a real semantic duplicate scored ~0.14 here during pilot
        // testing). The AI filter call below — which receives existingTitles
        // and knownAngleTexts as explicit context — is the actual authority
        // on semantic coverage/distinctness (signals C/D from the brief).
        const tooSimilar = isTooSimilarToAnything(candidate.question, [
          ...existingTitles,
          ...knownAngleTexts,
          ...priorQuestions
        ]);

        if (tooSimilar) {
          rejectedCount++;
          logEvent({
            cluster: clusterId, market: PILOT_MARKET, seedQuery, question: candidate.question,
            provider: providerName, accepted: false, rejectionReason: 'too_similar_or_already_covered',
            details: tooSimilar
          });
          continue;
        }

        let verdict;
        try {
          const raw = await callAI(buildFilterPrompt(clusterId, cluster.displayName, candidate.question, candidate.snippet, [
            ...existingTitles,
            ...knownAngleTexts
          ]));
          verdict = extractJsonObject(raw);
        } catch (err) {
          rejectedCount++;
          logEvent({
            cluster: clusterId, market: PILOT_MARKET, seedQuery, question: candidate.question,
            provider: providerName, accepted: false, rejectionReason: 'filter_error', error: err.message
          });
          continue;
        }

        if (!verdict || verdict.decision !== 'accept') {
          rejectedCount++;
          logEvent({
            cluster: clusterId, market: PILOT_MARKET, seedQuery, question: candidate.question,
            provider: providerName, accepted: false,
            rejectionReason: verdict?.rejectionReason || 'rejected_by_filter',
            rationale: verdict?.rationale
          });
          continue;
        }

        const opportunity = {
          id: opportunityId(clusterId, candidate.question),
          question: candidate.question,
          source: providerName,
          sourceQuery: seedQuery,
          market: PILOT_MARKET,
          cluster: clusterId,
          intent: verdict.intent || null,
          contentPotential: verdict.contentPotential || null,
          businessConnection: verdict.businessConnection || 'none',
          keywords: Array.isArray(verdict.keywords) && verdict.keywords.length > 0 ? verdict.keywords : [candidate.question],
          relatedSnippet: candidate.snippet,
          rationale: verdict.rationale || null,
          discoveredAt: new Date().toISOString(),
          status: 'accepted' // NOT auto-consumable — see file header.
        };

        pool.push(opportunity);
        priorQuestions.push(candidate.question);
        acceptedCount++;
        logEvent({ ...opportunity, accepted: true });
      }
    }
  }

  writeJson(POOL_PATH, pool);
  console.log(`[demand-engine] Research run complete. Accepted: ${acceptedCount}, Rejected: ${rejectedCount}. Pool size: ${pool.length}.`);
  console.log('[demand-engine] All accepted opportunities have status "accepted" — none are live/consumable yet.');
  console.log('[demand-engine] Review scripts/opportunity-pool.json, then run scripts/promote-opportunity.mjs <id> to approve one for publishing.');
}

await runResearch().catch(err => {
  // Never let a research-job failure surface as a failed CI step in a way
  // that could be confused with the publishing pipeline breaking — log
  // clearly and exit cleanly. This script never writes to used-angles.json,
  // dynamic-angles.json, or any blog post file, so there is nothing for a
  // partial failure here to corrupt.
  console.error(`[demand-engine] Research run failed: ${err.message}`);
  logEvent({ fatal: true, error: err.message });
  process.exitCode = 0;
});
