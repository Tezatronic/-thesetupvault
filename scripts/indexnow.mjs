// IndexNow submitter — tells Bing (and other IndexNow engines) about new/updated URLs
// the moment they go live, instead of waiting for a crawl.
//
// Modes:
//   --from-git   URLs for blog posts ADDED in the latest commit (+ home and /blog/).
//                Used by the publishing workflow right after it pushes a new post.
//   --sitemap    Every URL in the live sitemap. One-time backfill (manual workflow).
//   --urls a b   Explicit URLs.
// Flags:
//   --dry-run    Print what would be submitted, send nothing, skip the live-wait.
//   --strict     Exit non-zero on failure (manual workflow). Default is fail-soft:
//                a failed ping must never block or fail blog publishing.
//
// Env overrides (used for local testing): INDEXNOW_SITE, INDEXNOW_KEY, INDEXNOW_ENDPOINT,
// INDEXNOW_WAIT_ATTEMPTS, INDEXNOW_WAIT_MS.
import { execSync } from 'node:child_process';
import path from 'node:path';

const SITE = (process.env.INDEXNOW_SITE || 'https://thesetupvault.vercel.app').replace(/\/$/, '');
const KEY = process.env.INDEXNOW_KEY || 'eee8e53ef45e423687ba59df31e1cb2c';
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const WAIT_ATTEMPTS = Number(process.env.INDEXNOW_WAIT_ATTEMPTS || 24); // x15s = 6 min
const WAIT_MS = Number(process.env.INDEXNOW_WAIT_MS || 15000);
const CHUNK = 10000; // IndexNow max URLs per request

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const STRICT = args.includes('--strict');

const log = (...m) => console.log('[indexnow]', ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function urlsFromGit() {
  let out = '';
  try {
    out = execSync('git diff --name-only --diff-filter=A HEAD~1 HEAD -- src/content/blog', {
      encoding: 'utf8',
    });
  } catch (e) {
    log('could not read git diff (no previous commit?):', e.message.split('\n')[0]);
    return [];
  }
  const posts = out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\.(md|mdx)$/.test(l))
    .map((l) => `${SITE}/blog/${path.basename(l).replace(/\.(md|mdx)$/, '')}/`);
  // Home and blog index list the newest posts, so tell engines they changed too.
  return posts.length ? [...posts, `${SITE}/`, `${SITE}/blog/`] : [];
}

async function urlsFromSitemap() {
  const locs = async (u) => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`${u} -> HTTP ${res.status}`);
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  };
  const index = await locs(`${SITE}/sitemap-index.xml`);
  const all = [];
  for (const u of index) all.push(...(await locs(u)));
  return all;
}

async function waitUntilLive(url) {
  for (let i = 1; i <= WAIT_ATTEMPTS; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (res.status === 200) {
        log(`live after ${i} check(s): ${url}`);
        return true;
      }
      log(`not live yet (HTTP ${res.status}), check ${i}/${WAIT_ATTEMPTS}`);
    } catch (e) {
      log(`not reachable yet (${e.message}), check ${i}/${WAIT_ATTEMPTS}`);
    }
    await sleep(WAIT_MS);
  }
  return false;
}

async function submit(urls) {
  const host = new URL(SITE).host;
  const keyLocation = `${SITE}/${KEY}.txt`;
  for (let i = 0; i < urls.length; i += CHUNK) {
    const batch = urls.slice(i, i + CHUNK);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: KEY, keyLocation, urlList: batch }),
    });
    const body = (await res.text()).slice(0, 300);
    // 200 = received, 202 = received, key validation pending. Both are success.
    if (res.status === 200 || res.status === 202) {
      log(`submitted ${batch.length} URL(s): HTTP ${res.status}`);
    } else {
      throw new Error(`IndexNow rejected batch: HTTP ${res.status} ${body}`);
    }
  }
}

async function main() {
  let urls = [];
  if (args.includes('--from-git')) urls = urlsFromGit();
  else if (args.includes('--sitemap')) urls = await urlsFromSitemap();
  else if (args.includes('--urls')) urls = args.slice(args.indexOf('--urls') + 1).filter((a) => a.startsWith('http'));
  else throw new Error('Specify --from-git, --sitemap or --urls');

  urls = [...new Set(urls)];
  if (!urls.length) return log('no URLs to submit, nothing to do');
  log(`${urls.length} URL(s) selected`);
  urls.slice(0, 5).forEach((u) => log('  ', u));
  if (urls.length > 5) log(`   ...and ${urls.length - 5} more`);

  if (DRY) return log('dry run, nothing sent');

  // Bing must be able to fetch the page and the key file when it processes the ping,
  // so wait for the deploy first. Only the git mode needs this; the sitemap is already live.
  if (args.includes('--from-git')) {
    const live = await waitUntilLive(urls[0]);
    if (!live) throw new Error(`deploy not live after waiting, skipped ping for ${urls[0]}`);
  }
  await submit(urls);
}

main().catch((e) => {
  log('FAILED:', e.message);
  process.exit(STRICT ? 1 : 0);
});
