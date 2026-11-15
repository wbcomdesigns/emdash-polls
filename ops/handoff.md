# Handoff: WB Polls (2026-11-15)

Live: **0.5.1** on the EmDash registry as `@vapvarun.bsky.social/polls`. Public page: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/polls

Test on a fresh `create-emdash` blog site (registry install, kit from the release tag) and on the Cloudflare test site. On Cloudflare, redeploy after a registry install or update before judging anything (emdash-cms/emdash#4865).

## Next: 0.5.2

Milestone `0.5.2` on GitHub holds the work, in this order:

- #62 Small points from the 0.5.0 Cloudflare walk
- #64 Composite storage indexes for filtered and sorted queries
- #66 Poll panel: Remove from this page showed no change for 7 seconds on Cloudflare
- #69 Next release: registry install text and shared kit

Then the release gate (`gate.sh`, which also checks that no public file carries machine paths and that the README is the product landing page), an independent walk on Node and Cloudflare, and publish only with the owner's go-ahead.

## What 0.5.0 changed in the data

- New storage collection `tallies` (one record per poll: counts by answer position, `seq`, `step`, `ready`). Vote rows stay the source of truth. Polls from 0.4.0 get theirs on first read (one query up to 100 vote rows, else a few `count` calls per call), on the admin list (one query for the listed polls), or with Results, Recount votes.
- New index `attach` on `polls`. Stored `status` can be `deleting` while a deleted poll's votes are removed by list loads (`deleteStep`).
- One KV key per voter, `vote:<who>`, holds the lock and the hourly count. The 0.4.0 keys `ballot:*` and `rate:vote:*` are no longer read.
- Reads never store a status: `effectiveStatus` derives open and closed from the dates.

## How to work

GitHub issues only. Branch named for the next version. Never merge, tag or publish unless the owner asks. No AI attribution. No em-dashes. Any new route or admin action gets a case in `tests/bridge-budget.test.ts` at its worst case.
