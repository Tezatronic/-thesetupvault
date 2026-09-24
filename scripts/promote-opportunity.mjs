// The literal implementation of "reviewable batch before scaling": an
// opportunity that demand-research.mjs accepted sits at status "accepted"
// forever until a human runs this script on it. generate-post.mjs's Phase 0
// only ever looks for status "ready" — "accepted" is invisible to the
// publisher. This is a one-line promotion, on purpose: review happens by
// reading scripts/opportunity-pool.json (or the log) yourself, not by any
// automated scoring gate deciding what counts as "reviewed."
//
// Usage: node scripts/promote-opportunity.mjs <opportunity-id>
//        node scripts/promote-opportunity.mjs --list      (show all "accepted" opportunities)

import fs from 'node:fs';
import path from 'node:path';

const POOL_PATH = path.join('scripts', 'opportunity-pool.json');

function readPool() {
  if (!fs.existsSync(POOL_PATH)) {
    console.log('No opportunity pool found yet — run scripts/demand-research.mjs first.');
    process.exit(0);
  }
  return JSON.parse(fs.readFileSync(POOL_PATH, 'utf8'));
}

const arg = process.argv[2];
const pool = readPool();

if (!arg || arg === '--list') {
  const pending = pool.filter(o => o.status === 'accepted');
  if (pending.length === 0) {
    console.log('No opportunities awaiting review (status "accepted").');
  } else {
    console.log(`${pending.length} opportunity(ies) awaiting review:\n`);
    for (const o of pending) {
      console.log(`[${o.id}] (${o.cluster}, ${o.market})`);
      console.log(`  Question: ${o.question}`);
      console.log(`  Intent: ${o.intent} | Content potential: ${o.contentPotential} | Business connection: ${o.businessConnection}`);
      console.log(`  Rationale: ${o.rationale}\n`);
    }
    console.log('Run: node scripts/promote-opportunity.mjs <id>   to approve one for publishing.');
  }
  process.exit(0);
}

const target = pool.find(o => o.id === arg);
if (!target) {
  console.error(`No opportunity with id "${arg}" found.`);
  process.exit(1);
}
if (target.status !== 'accepted') {
  console.error(`Opportunity "${arg}" has status "${target.status}", not "accepted" — nothing to promote.`);
  process.exit(1);
}

target.status = 'ready';
target.promotedAt = new Date().toISOString();
fs.writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2) + '\n');
console.log(`Promoted "${arg}" to status "ready". It will be picked up on the next generate-post.mjs run.`);
