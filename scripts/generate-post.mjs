import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS_PATH = path.join('scripts', 'products.json');
const USED_PATH = path.join('scripts', 'used-angles.json');
const BLOG_DIR = path.join('src', 'content', 'blog');

const BANNED_PHRASES = [
  'revolutionary', 'game-changing', 'must-have', 'testament to', 'delve',
  'landscape', 'elevate your space', "in today's fast-paced world",
  'in conclusion', "it's important to note", 'imagine sitting at your desk'
];

// Depth-first cluster picking: finish all angles of the current cluster
// (in file order) before moving to the next cluster. This builds topical
// authority instead of spreading one-article-per-product forever.
function pickAngle() {
  const clusters = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  let used = JSON.parse(fs.readFileSync(USED_PATH, 'utf8'));

  const key = (clusterId, angle) => `${clusterId}:${angle}`;

  let chosenCluster = null;
  let chosenAngle = null;

  for (const cluster of clusters) {
    const nextAngle = cluster.angles.find(a => !used.includes(key(cluster.cluster, a.angle)));
    if (nextAngle) {
      chosenCluster = cluster;
      chosenAngle = nextAngle;
      break;
    }
  }

  if (!chosenCluster) {
    used = [];
    chosenCluster = clusters[0];
    chosenAngle = clusters[0].angles[0];
  }

  used.push(key(chosenCluster.cluster, chosenAngle.angle));
  fs.writeFileSync(USED_PATH, JSON.stringify(used, null, 2));

  const siblingAngles = chosenCluster.angles.filter(a => a.angle !== chosenAngle.angle);

  return { cluster: chosenCluster, angle: chosenAngle, siblingAngles };
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

function buildPrompt(cluster, angle, siblingAngles, existingPosts) {
  const keywordList = angle.keywords.join(', ');

  const internalLinksBlock = existingPosts.length > 0
    ? `\nEXISTING ARTICLES ON THIS SITE (for internal linking):\n${existingPosts.map(p => `- "${p.title}" — ${p.url}`).join('\n')}\n`
    : '\n(No existing articles yet — this may be one of the first posts, skip internal linking.)\n';

  const cannibalizationBlock = siblingAngles.length > 0
    ? `\nOTHER ARTICLES IN THIS SAME PRODUCT CLUSTER (do not target these angles or keywords — stay tightly focused on YOUR angle only, to avoid two pages on this site competing for the same search term):\n${siblingAngles.map(a => `- "${a.focus}" (covers: ${a.keywords.join(', ')})`).join('\n')}\nIf one of these has already been published (check the existing articles list above) and it's genuinely relevant, you may link to it once — but do not restate or re-cover its content here.\n`
    : '';

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
- Insert the exact same affiliate link, using this exact format: [Check current price](${cluster.link}) — a total of 4 to 5 separate times throughout the article, never a placeholder link. Place them at these natural points: (1) shortly after the opening answer, for readers who already know they want this, (2) after you cover the key factors/considerations section, (3) right after the main product recommendation/breakdown — this is the highest-intent placement, (4) right after the drawbacks/limitations section, for readers who wanted reassurance first, (5) once more near the very end of the article. Each instance should sit on its own line, not buried mid-sentence inside a paragraph.
- Do not use any of these words or phrases anywhere in the article: ${BANNED_PHRASES.join(', ')}.
- Do not use hypothetical-scenario openers like "Picture this" or "Imagine sitting at your desk."
- Write like a knowledgeable person who actually uses home office gear, not like generic marketing copy.
- Target length: 900-1400 words.

Output only the markdown file content, nothing else — no preamble, no code fences, no explanation.`;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 5000; // 5s, 10s, 20s backoff between attempts

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
        const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed (network error). Retrying in ${delay / 1000}s...`);
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

    const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
    console.warn(`Attempt ${attempt}/${MAX_ATTEMPTS} failed (HTTP ${res.status}, retryable). Retrying in ${delay / 1000}s...`);
    await sleep(delay);
  }

  throw lastError;
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
// Gemini wrote in the frontmatter — always overwrite it with the actual date.
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
// these two fields regardless of what Gemini output, rather than trust the
// model to remember proper YAML escaping every time.
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
  const { cluster, angle, siblingAngles } = pickAngle();
  const existingPosts = getExistingPosts();
  const prompt = buildPrompt(cluster, angle, siblingAngles, existingPosts);
  const raw = await callGemini(prompt);
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
  console.log(`Wrote new post: ${filePath} (cluster: ${cluster.cluster}, angle: ${angle.angle})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
