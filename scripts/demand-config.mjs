// Phase 1 pilot scope. Per the brief: do NOT expand to all 11 clusters or
// additional markets until the first reviewed batch justifies it. Widening
// this later is just editing these two lists.

export const PILOT_MARKET = 'US';

// cluster ids must match scripts/products.json entries exactly.
export const PILOT_CLUSTERS = ['laptop-stand', 'cable-organizer', 'monitor-stand'];

// A small, deliberately non-exhaustive seed set per cluster — this run's
// job is to test whether the pipeline finds GOOD opportunities, not to
// maximize query volume against a 250-search/month free-tier budget.
// 3 clusters x 3 seeds = 9 SerpApi calls per research run.
export const SEED_QUERIES = {
  'laptop-stand': [
    'laptop stand',
    'adjustable laptop stand',
    'laptop stand ergonomics'
  ],
  'cable-organizer': [
    'cable management desk',
    'under desk cable organizer',
    'reusable cable ties'
  ],
  'monitor-stand': [
    'monitor stand',
    'monitor stand height',
    'dual monitor setup'
  ]
};
