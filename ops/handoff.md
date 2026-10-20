# Handoff: WB Polls (2026-10-20)

Live: **0.4.0** on the EmDash registry as `@vapvarun.bsky.social/polls`.

Public page: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/polls

Lab is `../emdash-lab-polls` on port 4332 (fresh `--template blog`). Shared judging site `~/code/emdash-lab-all` (port 4340). Cloudflare testbed `~/code/emdash-plugin-testbed`.

## Next

- 0.5.0 is on branch `0.5.0` with a pull request into main (#60): every entry point fits Cloudflare's 10 requests per plugin call. `tests/bridge-budget.test.ts` pins every entry at 9 or fewer on a busy seeded site; `KNOWN_OVER` is empty.
- Before publish: a Sonnet walk of `docs/qa/QA_CHECKLIST.md` on the Node lab and the Cloudflare testbed (cases A-5, A-20 to A-23 and C-1 to C-7 are new), the independent pre-publish review, and the owner's word.
- Cloudflare stays "not supported yet" in `docs/registry/installation.md` and the install guide until that walk passes. The draft replacement line is in the pull request.
- Do not republish an existing version: a registry release cannot be changed.

## What 0.5.0 changed in the data

- New storage collection `tallies` (one record per poll: counts by answer position, `seq`, `step`, `ready`). Vote rows stay the source of truth. Polls from 0.4.0 get theirs on first read (one query up to 100 vote rows, else a few `count` calls per call), on the admin list (one query for the listed polls), or with Results, Recount votes.
- New index `attach` on `polls`. Stored `status` can be `deleting` while a deleted poll's votes are removed by list loads (`deleteStep`).
- One KV key per voter, `vote:<who>`, holds the lock and the hourly count. The 0.4.0 keys `ballot:*` and `rate:vote:*` are no longer read.
- Reads never store a status: `effectiveStatus` derives open and closed from the dates.

## How to work

GitHub issues only. Branch named for the next version. Never merge, tag or publish unless the owner asks. No AI attribution. No em-dashes. Any new route or admin action gets a case in `tests/bridge-budget.test.ts` at its worst case.
