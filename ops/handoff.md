# Handoff: Polls

Read this first. Then `SCOPE.md`, `AGENTS.md`, `CONTRIBUTING.md` and `docs/qa/QA_CHECKLIST.md`.

## Where it stands (2026-10-13)

Starter only. Nothing built.

| Thing | Where |
| --- | --- |
| Repo | `wbcomdesigns/emdash-polls`, local `~/code/emdash-polls` |
| Registry package | `@vapvarun.bsky.social/polls` (not published) |
| Lab site | `~/code/emdash-lab-polls`, port 4332 |
| Cards | GitHub issues in this repo, milestone `0.1.0` |
| Reference plugin | `~/code/emdash-listora` (shipped), `~/code/emdash-reviews` (same starter, engine built) |
| Shared starter | `~/code/emdash-plugin-starter` |

## Start

```bash
cd ~/code/emdash-polls
npm install --legacy-peer-deps
npm test
./scripts/setup-lab.sh
./scripts/reset-lab.sh
```

## Cards, in order

1. Schema and manifest
2. Admin: create, edit, open, close, delete
3. Public read and results visibility
4. Voting
5. Poll component
6. My votes and erase
7. Admin results view
8. Guest participation
9. Lab, prove script and demo page
10. Owner docs, registry branding and release gate

Each card lists what to build, when it is UX ready, when it is function ready, and the QA cases that prove it. A card is done when all three hold and you have commented on it with what you verified and how. Take them in order: later cards assume earlier ones.

## Decisions already made

- Free scope only. `SCOPE.md` lists what is in and what is out.
- Members sign in with their EmDash account. Guests can do only what `SCOPE.md` marks public.
- Kit markup is the same for every visitor, because site pages are cached without regard to cookies.
- The owner publishes. Agents stop at a passing gate and hand over.

## Watch for

- Tallies come from `storage.count` per option: up to 10 counts per poll view. Confirm the cost, and cache the tally on the poll row only if it is a problem
- Editing options after votes exist would orphan votes. Lock option ids once a poll has votes: labels can change, options cannot be removed
- `closes_at` is checked on read. There is no scheduler, so a poll closes the next time anyone loads it
- Block Kit `repeater` renders nothing inside a form. Options are a textarea
- Results `after_vote` must be enforced on the server. A guest request must not receive hidden results
- Guest routes are public writes. Per-visitor limit, honeypot, length caps, and refuse when the host gives no IP. Never trust a visitor id from the request: derive it from the request's IP on the server

## When you stop

Rewrite "Where it stands" with the date and the truth: what works, what was verified and how, what was not verified. Update `docs/qa/QA_CHECKLIST.md`'s last-walk line the same way.
