# SEO baseline: Oct 31, 2026 (Search Console export, last 28 days)

Purpose: on **Nov 21, 2026** compare a fresh Search Console export against this baseline, to see whether the title and description rewrite on Oct 31 (commit 31fff40) helped.
**Do not ask the owner what he wants. The task is below. Just do it.**

## What was changed on Oct 31
Titles shortened to 60 characters or fewer and descriptions tightened on the 11 articles below. URLs, body text and canonical tags were not changed. Not touched on purpose: the wireless-charging-mouse-pad cleaning article (position 2.4, had a click) and the ergonomic keyboard/mouse combo article (had a click). The desk lamps topic hub was left alone.

## Overall baseline (28 days to Oct 31)
- Total clicks 6, impressions 1,340, average CTR 0.4%, average position 12.6
- About 95% of all impressions came in the last 7 days, because the site was only just indexed (69 pages indexed on Oct 23)
- Listed queries: 212 rows (about 811 impressions; the rest are hidden by Google), 0 clicks on any listed query
- 77 queries sat at positions 4 to 10 (474 impressions)
- About 60% of queries are odd "X vs Y" mash-ups that look like Google testing, not real demand

## The 11 rewritten pages: baseline (clicks / impressions / avg position) and old to new title
| Page slug | Clicks | Impr | Pos | Old title | New title |
|---|---|---|---|---|---|
| how-to-use-one-keyboard-and-mouse-for-two-computers-dual-desk-setup-guide | 0 | 114 | 27.6 | How to Use One Keyboard and Mouse for Two Computers: Dual-Desk Setup Guide | One Keyboard and Mouse for Two Computers: Setup Guide |
| monitor-stand-vs-monitor-arm-which-fits-your-desk-better | 0 | 114 | 12.2 | Monitor Stand vs Monitor Arm: Which Fits Your Desk Better? | Monitor Stand vs Monitor Arm: Which Fits Your Desk Better? |
| best-powered-usb-hub-for-laptop-setups-a-practical-buying-guide | 0 | 108 | 8.1 | Best Powered USB Hub for Laptop Setups – A Practical Buying Guide | Best Powered USB Hub for Laptops: What to Look For |
| standing-desk-cable-management-how-to-manage-cable-slack-on-an-adjustable-desk | 0 | 86 | 23.1 | Standing Desk Cable Management: How to Manage Cable Slack on an Adjustable Desk | Standing Desk Cable Management: Handle Cable Slack |
| can-a-wireless-charging-mouse-pad-actually-charge-a-wireless-mouse | 0 | 66 | 6.2 | Can a Wireless Charging Mouse Pad Actually Charge a Wireless Mouse? | Can a Wireless Charging Mouse Pad Charge a Wireless Mouse? |
| usb-hub-troubleshooting-fix-connectivity-speed-and-power-issues-in-your-home-office | 0 | 55 | 13.2 | USB Hub Troubleshooting: Fix Connectivity, Speed, and Power Issues in Your Home Office | USB Hub Not Working? Fix Connection, Speed and Power Issues |
| aluminum-vs-plastic-usb-hubs-which-is-better-for-your-laptop-desk-setup | 0 | 33 | 8.3 | Aluminum vs Plastic USB Hubs – Which Is Better for Your Laptop Desk Setup? | Aluminum vs Plastic USB Hubs: Which Is Better? |
| what-to-know-about-usb-c-hubs-with-pd-charging-for-desk-setups | 0 | 28 | 9.7 | What to Know About USB-C Hubs with PD Charging for Desk Setups | USB-C Hubs with PD Charging: What to Know for Your Desk |
| laptop-stand-vs-riser-which-one-actually-solves-your-home-office-needs | 0 | 27 | 12.0 | Laptop Stand vs Riser: Which One Actually Solves Your Home‑Office Needs? | Laptop Stand vs Riser: Which Is Better for Your Desk? |
| wireless-charging-pad-vs-stand-which-flat-or-upright-charger-fits-your-desk | 0 | 25 | 7.3 | Wireless Charging Pad vs Stand: Which Flat or Upright Charger Fits Your Desk? | Wireless Charging Pad vs Stand: Which Fits Your Desk? |
| the-best-led-desk-lamp-for-reading-and-studying-a-practical-buying-guide-1789054978216 | 0 | 24 | 10.2 | The Best LED Desk Lamp for Reading and Studying – A Practical Buying Guide | Best LED Desk Lamp for Reading and Studying: Buying Guide |

## Top queries at baseline (impressions, position)
- led desk lamp setup guide: 267 impressions, position 8.3
- how to clean wireless charger: 60 impressions, position 1.0
- standing desk cable management: 52 impressions, position 23.9
- best usb hub for engineers: 29 impressions, position 7.7
- best space saving usb hub: 24 impressions, position 7.9
- best longest lasting desk lamp: 16 impressions, position 11.4
- desk lamp vs usb hub: 7 impressions, position 4.3
- laptop stand setup guide: 6 impressions, position 5.0
- best usb hub for writers: 6 impressions, position 7.0
- best manual usb hub: 6 impressions, position 7.7
- do i need a laptop stand, or is a riser just a gimmick?: 6 impressions, position 9.8
- setup planner: 6 impressions, position 14.7
- monitor arm vs wireless charger: 5 impressions, position 4.6
- how to organize standing desk: 5 impressions, position 8.2
- best end table for commuters: 5 impressions, position 9.6

## Plan for the Nov 21 session (owner will upload the new export zip: Queries.csv, Pages.csv, Chart.csv and others)
1. Compare each of the 11 pages: clicks, impressions, CTR, position vs the table above. Report winners, losers and anything flat.
2. If a page's position dropped by more than 5 places or lost most of its impressions, say so and offer to restore its old title from git (commit 31fff40^).
3. Note that early data is volatile for a new site: judge by trend across the 11 pages, not one page.
4. Then propose the next batch of title rewrites (pages with real impressions at positions 4 to 20 and 0 clicks), and the new search-intent articles to write: a dedicated LED desk lamp setup guide (the query "led desk lamp setup guide" had 267 impressions and only the topic hub ranked), then USB hub and wireless charging long-tail topics.
5. Also update the writer (scripts/generate-post.mjs) so new articles start from a real search query, with a title of 60 characters or fewer and a direct answer in the first paragraph, if the owner agrees.
