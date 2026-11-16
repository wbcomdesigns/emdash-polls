# Handoff: WB Polls (2026-11-16)

Live: **0.5.1** on the EmDash registry as `@vapvarun.bsky.social/polls`. Public page: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/polls

Test on a fresh `create-emdash` blog site (registry install, kit from the release tag) and on the Cloudflare test site. On Cloudflare, redeploy after a registry install or update before judging anything (emdash-cms/emdash#4865).

## Next: 0.5.2 (branch `0.5.2`, pull request open)

0.5.2 fixes the 2026-11-16 QA pass (#71 to #75) and carries #62 (parts), #69. Not merged, tagged or published.

- Delete my votes no longer counts toward the hourly vote limit (8 vote writes an hour); it still takes the voter lock.
- Answers must differ (case and spaces ignored). Open refuses a poll past its closing date; save refuses a new past closing date or one before the opening date.
- Polls list: Poll, Status, Actions first; long questions shortened. Open, Close and Delete keep the page and search (the answer's search reads one page of 100 to stay in budget).
- Poll panel has Find a poll by its question. The kit asks once per address per page load.
- Left open for the coordinator: #64 (new indexes ship in a minor, per the issue), #66 (not reproduced on Node; needs the Cloudflare testbed), #62 points on the dashboard figure and the shared `pluginFetch` (starter).

Then the release gate, an independent walk on Node and Cloudflare, and publish only with the owner's go-ahead.

## What 0.5.0 changed in the data

- New storage collection `tallies` (one record per poll: counts by answer position, `seq`, `step`, `ready`). Vote rows stay the source of truth. Polls from 0.4.0 get theirs on first read (one query up to 100 vote rows, else a few `count` calls per call), on the admin list (one query for the listed polls), or with Results, Recount votes.
- New index `attach` on `polls`. Stored `status` can be `deleting` while a deleted poll's votes are removed by list loads (`deleteStep`).
- One KV key per voter, `vote:<who>`, holds the lock and the hourly count. The 0.4.0 keys `ballot:*` and `rate:vote:*` are no longer read.
- Reads never store a status: `effectiveStatus` derives open and closed from the dates.

## How to work

GitHub issues only. Branch named for the next version. Never merge, tag or publish unless the owner asks. No AI attribution. No em-dashes. Any new route or admin action gets a case in `tests/bridge-budget.test.ts` at its worst case.
