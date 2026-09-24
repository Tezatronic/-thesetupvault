import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS_PATH = path.join('scripts', 'products.json');
const USED_PATH = path.join('scripts', 'used-angles.json');
const BLOG_DIR = path.join('src', 'content', 'blog');
const PRODUCT_CTAS_PATH = path.join('scripts', 'product-ctas.json');

// Dynamic-angle-generation state (added to replace the finite hand-written
// angle pool once it's exhausted). products.json/its 11 clusters stay the
// taxonomy of record; these files hold angles generated at runtime.
const DYNAMIC_ANGLES_PATH = path.join('scripts', 'dynamic-angles.json'); // { clusterId: [angleObj, ...] }
const DYNAMIC_POINTER_PATH = path.join('scripts', 'dynamic-pointer.json'); // { nextClusterIndex: N }
const DYNAMIC_LOG_PATH = path.join('scripts', 'dynamic-angle-log.jsonl'); // audit trail, one JSON line per attempt

// Demand Engine Phase 1 pilot integration point — see the Phase 0 block in
// pickAngle() below. This file is written only by scripts/demand-research.mjs
// (status "accepted") and scripts/promote-opportunity.mjs (status "ready").
// generate-post.mjs only ever reads it, defensively, and only acts on
// status "ready".
const OPPORTUNITY_POOL_PATH = path.join('scripts', 'opportunity-pool.json');

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function logDynamicEvent(entry) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
  fs.appendFileSync(DYNAMIC_LOG_PATH, line + '\n');
  console.log(`[dynamic-angle] ${line}`);
}

// Data-driven cluster -> owned-product CTA mapping (Stage B). A cluster
// with no entry in product-ctas.json is treated as "Accessories" — Amazon
// affiliate CTAs only, no owned-product CTA. Adding a future Product #3 is
// a matter of adding cluster keys to product-ctas.json, not editing this
// script or buildPrompt().
function getProductCta(clusterId) {
  if (!fs.existsSync(PRODUCT_CTAS_PATH)) return null;
  const map = JSON.parse(fs.readFileSync(PRODUCT_CTAS_PATH, 'utf8'));
  return map[clusterId] || null;
}

const BANNED_PHRASES = [
  'revolutionary', 'game-changing', 'must-have', 'testament to', 'delve',
  'landscape', 'elevate your space', "in today's fast-paced world",
  'in conclusion', "it's important to note", 'imagine sitting at your desk'
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'to', 'of', 'in', 'on', 'with', 'vs',
  'your', 'you', 'is', 'are', 'best', 'guide', 'how', 'what', 'which', 'do',
  'does', 'it', 'this', 'that', 'at', 'desk', 'setup', 'home', 'office'
]);

function tokenize(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// "Deliberately narrow" cluster-agnostic wording (e.g. "buying guide",
// "comparison") is intentionally excluded from STOPWORDS-adjacent scope here
// because it's still meaningful within a cluster's own angle set. Threshold
// tuned conservatively (favor false rejections over false acceptances,
// since a rejected angle just triggers a cheap retry, while an accepted
// duplicate becomes a live duplicate-content page).
const SIMILARITY_REJECT_THRESHOLD = 0.34;

function findTooSimilar(candidateAngle, existingPosts, knownAnglesForCluster) {
  const candidateTokens = tokenize(
    `${candidateAngle.angle} ${candidateAngle.focus} ${(candidateAngle.keywords || []).join(' ')}`
  );

  for (const post of existingPosts) {
    const sim = jaccardSimilarity(candidateTokens, tokenize(post.title));
    if (sim >= SIMILARITY_REJECT_THRESHOLD) {
      return { against: 'published article', title: post.title, similarity: sim.toFixed(2) };
    }
  }

  for (const known of knownAnglesForCluster) {
    const knownTokens = tokenize(`${known.angle} ${known.focus} ${(known.keywords || []).join(' ')}`);
    const sim = jaccardSimilarity(candidateTokens, knownTokens);
    if (sim >= SIMILARITY_REJECT_THRESHOLD) {
      return { against: 'existing angle', title: known.focus, similarity: sim.toFixed(2) };
    }
  }

  return null;
}

function getAllKnownAnglesForCluster(cluster, dynamicAngles) {
  const dynamicForCluster = dynamicAngles[cluster.cluster] || [];
  return [...cluster.angles, ...dynamicForCluster];
}

function extractJsonObject(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in dynamic-angle generation response');
  }
  return JSON.parse(text.slice(start, end + 1));
}

function buildAngleGenPrompt(cluster, knownAngles, existingPosts, rejectionFeedback) {
  const knownAnglesBlock = knownAngles.length > 0
    ? knownAngles.map(a => `- "${a.angle}": ${a.focus} (keywords: ${(a.keywords || []).join(', ')})`).join('\n')
    : '(none yet)';

  const existingTitlesBlock = existingPosts.length > 0
    ? existingPosts.map(p => `- "${p.title}"`).join('\n')
    : '(no published articles yet)';

  const feedbackBlock = rejectionFeedback
    ? `\nYour previous suggestion was rejected as too similar to "${rejectionFeedback.title}" (a ${rejectionFeedback.against}). Propose something meaningfully different in search intent, not just a reworded title.\n`
    : '';

  return `You are a content strategist for The Setup Vault, a home-office/desk-setup affiliate blog. We need ONE new article angle for an existing product, distinct from everything already covered.

PRODUCT: ${cluster.displayName} (${cluster.realName})

ANGLES ALREADY COVERED FOR THIS PRODUCT (do not repeat or closely rephrase any of these — different search intent required):
${knownAnglesBlock}

ARTICLE TITLES ALREADY PUBLISHED ON THE SITE (avoid overlapping any of these too):
${existingTitlesBlock}
${feedbackBlock}
Propose one new angle that is genuinely useful to a home-office audience, targets different search intent than anything listed above, and would not read as a near-duplicate of any existing page.

Return ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"angle": "kebab-case-id", "focus": "one sentence describing this specific angle", "keywords": ["kw1", "kw2", "kw3"], "rationale": "one short sentence on why this is distinct from what's already covered"}`;
}

const MAX_DYNAMIC_ATTEMPTS = 3;

// Generates one new, checked-distinct angle for a single cluster. Returns
// null (not an error) if no sufficiently distinct angle could be produced
// after MAX_DYNAMIC_ATTEMPTS — the caller skips this cluster in that case
// rather than forcing a duplicate.
async function generateDynamicAngleForCluster(cluster, existingPosts, dynamicAngles) {
  const knownAngles = getAllKnownAnglesForCluster(cluster, dynamicAngles);
  const knownIds = new Set(knownAngles.map(a => a.angle));

  let rejectionFeedback = null;

  for (let attempt = 1; attempt <= MAX_DYNAMIC_ATTEMPTS; attempt++) {
    const prompt = buildAngleGenPrompt(cluster, knownAngles, existingPosts, rejectionFeedback);
    let candidate;
    try {
      const raw = await callAI(prompt);
      candidate = extractJsonObject(raw);
    } catch (err) {
      logDynamicEvent({ cluster: cluster.cluster, attempt, accepted: false, error: err.message });
      continue;
    }

    if (!candidate || !candidate.angle || !candidate.focus || !Array.isArray(candidate.keywords) || candidate.keywords.length === 0) {
      logDynamicEvent({ cluster: cluster.cluster, attempt, accepted: false, reason: 'malformed candidate', candidate });
      continue;
    }
    candidate.angle = slugify(candidate.angle);

    if (knownIds.has(candidate.angle)) {
      rejectionFeedback = { against: 'existing angle', title: candidate.angle };
      logDynamicEvent({ cluster: cluster.cluster, attempt, accepted: false, reason: 'duplicate angle id', candidate });
      continue;
    }

    const tooSimilar = findTooSimilar(candidate, existingPosts, knownAngles);
    if (tooSimilar) {
      rejectionFeedback = tooSimilar;
      logDynamicEvent({ cluster: cluster.cluster, attempt, accepted: false, reason: 'too similar', tooSimilar, candidate });
      continue;
    }

    logDynamicEvent({ cluster: cluster.cluster, attempt, accepted: true, candidate });
    return candidate;
  }

  logDynamicEvent({ cluster: cluster.cluster, accepted: false, reason: 'exhausted attempts, skipping cluster' });
  return null;
}

// Depth-first cluster picking: finish all angles of the current cluster
// (in file order) before moving to the next cluster. This builds topical
// authority instead of spreading one-article-per-product forever.
//
// IMPORTANT: used-angles.json is a PERMANENT record of every cluster:angle
// ever published, never reset. Once every hand-written slot in products.json
// has been used, this used to mean there was nothing left to write about
// (which is exactly what caused 138 posts across only 26 real topics before
// the anti-duplication fix). Now, once the hand-written pool for a cluster is
// exhausted, pickAngle() moves into DYNAMIC mode: instead of stopping, it
// asks the AI to propose a genuinely new, checked-distinct angle for a
// cluster (round-robin across clusters, tracked in dynamic-pointer.json, so
// no single product cluster monopolizes every future article). If no
// distinct angle can be found for a cluster after a few attempts, that
// cluster is skipped for this run — never forced — and the next cluster in
// the rotation is tried. Only if every cluster is skipped does this function
// return null, and main() stops cleanly instead of manufacturing a
// duplicate, exactly as before.
async function pickAngle() {
  const clusters = readJson(PRODUCTS_PATH, []);
  const used = readJson(USED_PATH, []);

  // Phase 0: Demand Engine opportunities (added for the Phase 1 pilot).
  // This is a READ-ONLY, fully defensive check — any problem here (file
  // missing, malformed JSON, no "ready" item) falls through to Phase 1
  // exactly as if this phase didn't exist. The Demand Engine's research job
  // (scripts/demand-research.mjs) runs completely separately and can never
  // reach this function directly; it only ever writes "accepted" status,
  // which this check ignores. Only a human-promoted "ready" opportunity
  // (via scripts/promote-opportunity.mjs) is ever picked up here — see
  // those two files for the full pilot design.
  try {
    const pool = readJson(OPPORTUNITY_POOL_PATH, []);
    const ready = Array.isArray(pool) ? pool.find(o => o && o.status === 'ready') : null;
    if (ready && ready.cluster && ready.question) {
      const cluster = clusters.find(c => c.cluster === ready.cluster);
      if (cluster) {
        const angle = {
          angle: slugify(ready.question).slice(0, 60),
          focus: ready.question,
          keywords: Array.isArray(ready.keywords) && ready.keywords.length > 0 ? ready.keywords : [ready.question],
          rationale: ready.rationale || null,
          demandOpportunityId: ready.id
        };

        // Claim it immediately (same pattern as the static/dynamic phases
        // below) so it can't be picked up twice if this run fails partway.
        ready.status = 'published';
        ready.publishedAt = new Date().toISOString();
        writeJson(OPPORTUNITY_POOL_PATH, pool);

        const key = (clusterId, a) => `${clusterId}:${a}`;
        used.push(key(cluster.cluster, angle.angle));
        writeJson(USED_PATH, used);

        const dynamicAnglesForSiblings = readJson(DYNAMIC_ANGLES_PATH, {});
        const siblingAngles = getAllKnownAnglesForCluster(cluster, dynamicAnglesForSiblings);

        return { cluster, angle, siblingAngles, source: 'demand-engine' };
      }
      console.warn(`[demand-engine] Ready opportunity "${ready.id}" references unknown cluster "${ready.cluster}" — skipping, falling through to normal angle selection.`);
    }
  } catch (err) {
    console.warn(`[demand-engine] Could not read opportunity pool, ignoring: ${err.message}`);
  }

  const key = (clusterId, angle) => `${clusterId}:${angle}`;

  // Phase 1: unchanged behavior — use up any remaining hand-written angle
  // first, in the same depth-first cluster order as before.
  for (const cluster of clusters) {
    const nextAngle = cluster.angles.find(a => !used.includes(key(cluster.cluster, a.angle)));
    if (nextAngle) {
      used.push(key(cluster.cluster, nextAngle.angle));
      writeJson(USED_PATH, used);
      const siblingAngles = cluster.angles.filter(a => a.angle !== nextAngle.angle);
      return { cluster, angle: nextAngle, siblingAngles };
    }
  }

  // Phase 2: hand-written pool is exhausted for every cluster. Generate a
  // new angle dynamically, round-robin across clusters so growth stays
  // balanced across all 11 products rather than piling onto cluster[0].
  const dynamicAngles = readJson(DYNAMIC_ANGLES_PATH, {});
  const pointer = readJson(DYNAMIC_POINTER_PATH, { nextClusterIndex: 0 });
  const existingPosts = getExistingPosts();

  const startIndex = pointer.nextClusterIndex % clusters.length;
  for (let offset = 0; offset < clusters.length; offset++) {
    const index = (startIndex + offset) % clusters.length;
    const cluster = clusters[index];

    const candidate = await generateDynamicAngleForCluster(cluster, existingPosts, dynamicAngles);
    if (!candidate) continue; // this cluster skipped, try the next one in rotation

    const angle = {
      angle: candidate.angle,
      focus: candidate.focus,
      keywords: candidate.keywords,
      rationale: candidate.rationale
    };

    dynamicAngles[cluster.cluster] = [...(dynamicAngles[cluster.cluster] || []), angle];
    writeJson(DYNAMIC_ANGLES_PATH, dynamicAngles);

    used.push(key(cluster.cluster, angle.angle));
    writeJson(USED_PATH, used);

    writeJson(DYNAMIC_POINTER_PATH, { nextClusterIndex: (index + 1) % clusters.length });

    const siblingAngles = getAllKnownAnglesForCluster(cluster, dynamicAngles)
      .filter(a => a.angle !== angle.angle);

    return { cluster, angle, siblingAngles };
  }

  // Every cluster was tried and skipped this run — nothing distinct to write.
  return null;
}

function getExistingPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8');
    const match = content.match(/title:\s*(.+)/);
    if (match) {
      const slug = file.replace(/\.md$/, '');
      const title = match[1].trim().replace(/^["']|["']$/g, '');
      posts.push({ title, url: `/blog/${slug}/` });
    }
  }
  return posts.slice(-25).reverse();
}

function buildPrompt(cluster, angle, siblingAngles, existingPosts, productCta) {
  const keywordList = angle.keywords.join(', ');

  const internalLinksBlock = existingPosts.length > 0
    ? `\nEXISTING ARTICLES ON THIS SITE (for internal linking):\n${existingPosts.map(p => `- "${p.title}" — ${p.url}`).join('\n')}\n`
    : '\n(No existing articles yet — this may be one of the first posts, skip internal linking.)\n';

  const cannibalizationBlock = siblingAngles.length > 0
    ? `\nOTHER ARTICLES IN THIS SAME PRODUCT CLUSTER (do not target these angles or keywords — stay tightly focused on YOUR angle only, to avoid two pages on this site competing for the same search term):\n${siblingAngles.map(a => `- "${a.focus}" (covers: ${a.keywords.join(', ')})`).join('\n')}\nIf one of these has already been published (check the existing articles list above) and it's genuinely relevant, you may link to it once — but do not restate or re-cover its content here.\n`
    : '';

  const productCtaBlock = productCta
    ? `- Additionally, include exactly ONE mention of our own product, "${productCta.name}" (${productCta.url}), framed as the logical next step for a reader who wants to go further than this one article — specifically around ${productCta.hook}. This is the PRIMARY CTA of the article, more prominent in framing than the Amazon links, but it must read as a genuine, specific, non-pushy next step, not an ad. Do not use hyped or ad-like language ("must-have," "game-changing," "don't miss out"). Solve the reader's actual question from this article first — the product mention should feel like the natural continuation once that's done, not an interruption. Place it wherever it fits most naturally given how this specific article's structure unfolds (this will vary article to article — do not force it into a fixed position like "right after the intro" every time). Use the exact link format: [descriptive link text tied to ${productCta.hook}](${productCta.url}), on its own line.`
    : `- This article's product category does not have a matching owned-product guide. Do not invent or reference an owned product for this article — Amazon affiliate links (per the rule above) are the only monetization link in this article.`;

  const specsBlock = cluster.verifiedSpecs
    ? `\nVERIFIED REAL SPECS FOR THIS PRODUCT (these are confirmed accurate — you may state these exact figures, and ONLY these, when making numeric claims):\n${Object.entries(cluster.verifiedSpecs).map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`).join('\n')}\nDo NOT state any other specific numeric spec, capacity, weight, dimension, or figure about this product beyond what is listed above. If you want to mention a spec not listed here, describe it qualitatively instead (e.g. "sturdy," "compact," "lightweight") rather than inventing a number.\n`
    : `\nNO VERIFIED SPECS ARE AVAILABLE FOR THIS PRODUCT YET. This means: DO NOT state any specific numeric weight capacity, dimension, weight, or spec figure anywhere in this article — even a "typical" or "roughly" estimated one. Describe qualities qualitatively instead (e.g. "sturdy," "compact," "widely compatible") rather than inventing a number that could be wrong.\n`;

  return `You are writing one SEO blog article for The Setup Vault, a home-office and desk-setup affiliate blog. The article must be genuinely useful, specific, and written in a natural, human voice.

PRODUCT FOR THIS ARTICLE:
- Display name: ${cluster.displayName}
- Real product: ${cluster.realName}
- Affiliate link: ${cluster.link}
${specsBlock}
YOUR SPECIFIC ANGLE FOR THIS ARTICLE (stay tightly focused on this — do not turn it into a generic product review):
- Angle: ${angle.angle}
- Focus: ${angle.focus}
- Target keywords: ${keywordList}
${cannibalizationBlock}${internalLinksBlock}
INTERNAL LINKING (based on tested results — this is one of the highest-impact SEO levers available, do not skip it if relevant articles exist above):
- Where genuinely relevant, link to 2-4 of the existing articles listed above using standard markdown links, e.g. [descriptive anchor text](/blog/some-slug/).
- Anchor text must be descriptive of the destination page's topic — never "click here" or "this article."
- Only link where it adds real context for the reader. Do not force links that don't fit naturally.
- If no listed article is genuinely relevant, don't link to it just to hit a quota.

=== AI OVERVIEW / AEO PLAYBOOK (apply these, they are based on real citation-rate testing) ===
1. INVERTED PYRAMID — ANSWER FIRST. Open with a direct, concrete answer sentence to the core question implied by your angle — no windup, no scene-setting. State the commonly accepted, mainstream answer or range in plain terms first. Only after that, layer in your own specific recommendation or take underneath it. Do not lead with a contrarian or unusual claim — pages that disagree with consensus get skipped even when correct.
2. MATCH THE SCOPE OF YOUR ANGLE. Answer at the scope your angle and keywords imply — don't artificially broaden into a full product review, and don't artificially narrow beyond what the angle covers.
3. BE THE COMPLETE ANSWER FOR YOUR ANGLE. Cover your specific angle fully: the headline answer, the range of options/considerations, the key factors/drivers, and at least one honest limitation or caveat — all in one place.
4. ONE UNIQUE CONCRETE FACT. Include at least one specific, concrete, real detail that is not generic filler — a real spec number, a real comparison point, a real usage detail (weight, dimensions, compatibility, a specific measurable benefit). Avoid vague quality claims ("durable", "high quality") without a concrete anchor.
5. DO NOT over-invest in formatting gimmicks. Skip FAQ-block stuffing and forcing every heading into question format — write natural headings that fit the content.
6. WRITE WITH A REAL POINT OF VIEW, NOT JUST FACTS. Generic AI-tone content (facts with no opinion, no specific example, no stance) gets down-ranked regardless of accuracy. Include at least one clear opinion or recommendation stated plainly and at least one concrete, specific scenario rather than speaking only in generalities.
=== END PLAYBOOK ===

REQUIREMENTS:
- Output ONLY the raw markdown file content, starting with a YAML frontmatter block delimited by --- lines, with exactly these fields: title, description, pubDate (format: YYYY-MM-DD, use today's date). Do not include a slug field.
- After the frontmatter, write the full article body in Markdown.
- Naturally include a "## Who This Isn't For" or "## Potential Drawbacks" section that names 1-2 real limitations relevant to your angle — do not invent fake numbers, but general/typical specs and honest tradeoffs are expected.
- Insert the exact same affiliate link, using this exact format: [Check current price](${cluster.link}) — a MAXIMUM of 2 separate times throughout the article, never a placeholder link, and never more than 2. Amazon is supporting monetization here, not the primary focus of the article. Place one instance at the highest-intent point (right after the main product recommendation/breakdown) and, if it fits naturally, one more near the very end. Each instance should sit on its own line, not buried mid-sentence inside a paragraph. If only one placement genuinely fits the article's flow, use only one — do not force a second just to hit a quota.
${productCtaBlock}
- Do not use any of these words or phrases anywhere in the article: ${BANNED_PHRASES.join(', ')}.
- Do not use hypothetical-scenario openers like "Picture this" or "Imagine sitting at your desk."
- Write like a knowledgeable person who actually uses home office gear, not like generic marketing copy.
- Target length: 900-1400 words.

Output only the markdown file content, nothing else — no preamble, no code fences, no explanation.`;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 8000;
const MAX_DELAY_MS = 60000; // cap each wait at 60s so retries don't balloon into an hours-long job

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
          generationConfig: { maxOutputTokens: 8192, temperature: 0.4 }
        })
      });
    } catch (networkErr) {
      lastError = new Error(`Gemini fetch failed: ${networkErr.message}`);
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
        console.warn(`Gemini attempt ${attempt}/${MAX_ATTEMPTS} failed (network error). Retrying in ${delay / 1000}s...`);
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
    if (!isRetryable || attempt === MAX_ATTEMPTS) {
      throw lastError;
    }

    const delay = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
    console.warn(`Gemini attempt ${attempt}/${MAX_ATTEMPTS} failed (HTTP ${res.status}, retryable). Retrying in ${delay / 1000}s...`);
    await sleep(delay);
  }

  throw lastError;
}

// Fallback provider — only called if Gemini fails all MAX_ATTEMPTS retries.
// Groq runs on its own hardware, fully independent of Google's infrastructure,
// so a Gemini outage doesn't take this down too. Free tier, OpenAI-compatible API.
// NOTE: Groq's free tier caps at 8000 tokens/minute (prompt + response combined),
// so max_tokens is kept modest here — the prompt itself is already long.
async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.4
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

// Tries Gemini first (with its full retry logic). Only if Gemini fails
// completely does this fall back to Groq as a last resort before giving up.
async function callAI(prompt) {
  try {
    return await callGemini(prompt);
  } catch (geminiErr) {
    console.warn(`Gemini failed after all retries: ${geminiErr.message}`);
    console.warn('Falling back to Groq...');
    try {
      return await callGroq(prompt);
    } catch (groqErr) {
      throw new Error(`Both providers failed. Gemini: ${geminiErr.message} | Groq: ${groqErr.message}`);
    }
  }
}

function cleanOutput(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:markdown|md)?\n/, '').replace(/\n```$/, '');
  text = text.trim();

  if (!text.startsWith('---')) {
    throw new Error('Output does not start with frontmatter delimiter');
  }

  const parts = text.split('---');
  if (parts.length < 3) {
    throw new Error('Frontmatter block is not properly closed');
  }

  const frontmatter = parts[1];
  if (!/title:/.test(frontmatter) || !/description:/.test(frontmatter) || !/pubDate:/.test(frontmatter)) {
    throw new Error('Frontmatter is missing required fields (title, description, pubDate)');
  }

  return text;
}

function extractTitle(text) {
  const match = text.match(/title:\s*(.+)/);
  if (!match) throw new Error('Could not extract title from frontmatter');
  return match[1].trim().replace(/^["']|["']$/g, '');
}

// Models don't reliably know the real current date. Never trust whatever date
// the model wrote in the frontmatter — always overwrite it with the actual date.
function forceRealPubDate(text) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (/pubDate:\s*.+/.test(text)) {
    return text.replace(/pubDate:\s*.+/, `pubDate: ${today}`);
  }
  return text.replace(/^---\n/, `---\npubDate: ${today}\n`);
}

// A bare colon-space inside an unquoted YAML scalar breaks frontmatter parsing
// (Astro's build fails the ENTIRE site on one bad file). Titles/descriptions
// frequently contain colons ("X vs Y: Which One..."), so always force-quote
// these two fields regardless of what the model output, rather than trust
// the model to remember proper YAML escaping every time.
function quoteFrontmatterFields(text) {
  const parts = text.split('---');
  let frontmatter = parts[1];

  for (const field of ['title', 'description']) {
    const re = new RegExp(`^${field}:\\s*(.+)$`, 'm');
    frontmatter = frontmatter.replace(re, (match, value) => {
      let v = value.trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return `${field}: ${v}`;
      }
      const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `${field}: "${escaped}"`;
    });
  }

  parts[1] = frontmatter;
  return parts.join('---');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const picked = await pickAngle();

  if (!picked) {
    console.log(
      'No sufficiently distinct angle could be found for any cluster this run ' +
      '(hand-written pool exhausted and dynamic generation could not clear the ' +
      'similarity check for every cluster). No post was written this run.'
    );
    return;
  }

  const { cluster, angle, siblingAngles, source } = picked;
  if (source === 'demand-engine') {
    console.log(`[demand-engine] Using human-approved opportunity "${angle.demandOpportunityId}" for ${cluster.cluster}: ${angle.focus}`);
  } else if (angle.rationale) {
    console.log(`[dynamic-angle] Using generated angle "${angle.angle}" for ${cluster.cluster}: ${angle.rationale}`);
  }
  const existingPosts = getExistingPosts();
  const productCta = getProductCta(cluster.cluster);
  const prompt = buildPrompt(cluster, angle, siblingAngles, existingPosts, productCta);
  const raw = await callAI(prompt);
  const cleanedRaw = cleanOutput(raw);
  const dated = forceRealPubDate(cleanedRaw);
  const cleaned = quoteFrontmatterFields(dated);
  const title = extractTitle(cleaned);
  let slug = slugify(title);

  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

  let filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) {
    slug = `${slug}-${Date.now()}`;
    filePath = path.join(BLOG_DIR, `${slug}.md`);
  }

  fs.writeFileSync(filePath, cleaned);
  console.log(
    `Wrote new post: ${filePath} (cluster: ${cluster.cluster}, angle: ${angle.angle}, ` +
    `productCta: ${productCta ? productCta.product : 'none (accessories/affiliate-only)'})`
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
