# WB Polls for EmDash

Create polls, let visitors or members vote once, and show live results anywhere on your site.

Status: 0.1.1. Live on the EmDash registry as `@vapvarun.bsky.social/polls`.

- Scope and schema: [SCOPE.md](SCOPE.md)
- Plan and decisions: [PLAN.md](PLAN.md)
- State of the work: [ops/handoff.md](ops/handoff.md)
- How to build and release: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release cases: [docs/qa/QA_CHECKLIST.md](docs/qa/QA_CHECKLIST.md)
- Registry listing copy: [docs/registry](docs/registry)

The plugin is the engine. An EmDash plugin cannot add pages to a site, so the visible parts ship as a site kit in `site-kit/` that the owner copies in once. See [site-kit/README.md](site-kit/README.md).

## What 0.1.0 does

- Admin: create, edit, open, close, delete, results, copy
- Who can vote: anyone, or signed-in members
- Attach to one page, a content type, or the whole site
- Anonymous or named results (owner only)
- Kit: `<Poll id />`, `<Poll latest />`, `<PollSlot />`
- One wording file for every visitor-facing phrase

Not in 0.1.0: My votes, member-created polls, a poll list page, export.

## Local lab

```bash
npm install --legacy-peer-deps
./scripts/setup-lab.sh
./scripts/reset-lab.sh
./scripts/prove-lab.sh
```

Then open http://127.0.0.1:4332/polls-demo and http://127.0.0.1:4332/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin/plugins/polls/polls
