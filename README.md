# WB Polls for EmDash

Create polls, let visitors or members vote once, and show live results anywhere on your site.

Status: 0.2.2. Live on the EmDash registry as `@vapvarun.bsky.social/polls`.

- Scope and schema: [SCOPE.md](SCOPE.md)
- Plan and decisions: [PLAN.md](PLAN.md)
- State of the work: [ops/handoff.md](ops/handoff.md)
- How to build and release: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release cases: [docs/qa/QA_CHECKLIST.md](docs/qa/QA_CHECKLIST.md)
- Registry listing copy: [docs/registry](docs/registry)

The plugin is the engine. An EmDash plugin cannot add pages to a site, so the visible parts ship as a site kit in `site-kit/` that the owner copies in once. See [site-kit/README.md](site-kit/README.md).

## What 0.2.2 fixes

- The page editor Poll panel opens a poll, or opens it after you create one.
- Polls list has a Status column. Results show vote totals as stats.

## What 0.2.1 fixes

- A closed poll stays on the page with its results. The owner can open it again.
- Copy keeps the attachment and opens the edit form so the heading can be renamed.
- The red "Pick an answer" line clears after a successful vote.
- The kit includes `/account/votes` for My votes.

## What 0.2.0 does

- Admin: create, edit, open, close, delete, results, copy
- Who can vote: anyone, or signed-in members
- Attach to one page, a content type, or the whole site
- Anonymous or named results (owner only)
- Kit: `<Poll id />`, `<Poll latest />`, `<PollSlot />`, `<MyVotes />`
- One wording file for every visitor-facing phrase
- My votes: a signed-in member can see and erase their own votes

Not in this release: member-created polls, a poll list page, export, an in-text Poll block.

## Local lab

```bash
npm install --legacy-peer-deps
./scripts/setup-lab.sh
./scripts/reset-lab.sh
./scripts/prove-lab.sh
```

Then open http://127.0.0.1:4332/polls-demo and http://127.0.0.1:4332/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin/plugins/polls/polls
