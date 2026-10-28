// Guard against bad internal links in AI-written posts.
// Every /blog/... link must point at a post that exists. If not, try (1) the
// redirect map in vercel.json, (2) a close slug match, else (3) drop the link and
// keep the anchor text. Links are always normalised to the canonical trailing-slash form.
import fs from 'node:fs';

function tokens(slug) {
  return new Set(slug.split('-').filter(t => t.length > 2));
}
function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function fixInternalLinks(markdown, existingPosts, redirectsPath = 'vercel.json') {
  const valid = new Set(existingPosts.map(p => p.url.replace(/^\/blog\//, '').replace(/\/$/, '')));
  let redirects = {};
  try {
    for (const r of JSON.parse(fs.readFileSync(redirectsPath, 'utf8')).redirects || []) {
      redirects[r.source.replace(/\/$/, '')] = r.destination.replace(/^\/blog\//, '').replace(/\/$/, '');
    }
  } catch { /* no redirect map available: fall through to similarity */ }

  const changes = [];
  const out = markdown.replace(/\[([^\]]+)\]\((\/blog\/[^)\s#?]+?)\/?\)/g, (full, text, href) => {
    const slug = href.replace(/^\/blog\//, '');
    if (valid.has(slug)) return `[${text}](/blog/${slug}/)`;
    const viaRedirect = redirects[href];
    if (viaRedirect && valid.has(viaRedirect)) {
      changes.push(`redirected ${slug} -> ${viaRedirect}`);
      return `[${text}](/blog/${viaRedirect}/)`;
    }
    let best = null, bestScore = 0;
    for (const v of valid) {
      const s = jaccard(slug, v);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    if (best && bestScore >= 0.6) {
      changes.push(`closest match ${slug} -> ${best} (${bestScore.toFixed(2)})`);
      return `[${text}](/blog/${best}/)`;
    }
    changes.push(`dropped link to non-existent ${slug}`);
    return text;
  });
  return { markdown: out, changes };
}
