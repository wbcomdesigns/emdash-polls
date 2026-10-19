# WB Polls for EmDash

Create polls, let visitors or members vote once, and show live results anywhere on your site.

Status: 0.4.0 in review. 0.3.0 is live on the EmDash registry as `@vapvarun.bsky.social/polls`.

- Install on a site: [docs/website/getting-started/install.md](docs/website/getting-started/install.md)
- Scope and schema: [SCOPE.md](SCOPE.md)
- Plan and decisions: [PLAN.md](PLAN.md)
- State of the work: [ops/handoff.md](ops/handoff.md)
- How to build and release: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release cases: [docs/qa/QA_CHECKLIST.md](docs/qa/QA_CHECKLIST.md)
- Registry listing copy: [docs/registry](docs/registry)
- What changed: [CHANGELOG.md](CHANGELOG.md)

The plugin is the engine. An EmDash plugin cannot add pages to a site, so the visible parts ship as a site kit in `site-kit/`. One command copies it: `scripts/add-to-site.sh /path/to/site`. See [site-kit/README.md](site-kit/README.md).

## What it does

- Admin: create, edit, open, close, delete, results with a chart, copy
- Who can vote: anyone (where the host gives EmDash the visitor's address), or signed-in members
- Attach to one page, a content type, or the whole site, above or below the content
- Anonymous or named results (owner only)
- Kit: `<Poll id />`, `<Poll latest />`, `<PollSlot />`, `<MyVotes />`, and an optional in-text block for a trusted install
- One wording file for every visitor-facing phrase
- My votes: a signed-in member can see and erase their own votes

Not in this plugin: member-created polls, a poll list page, export.

## Local lab

```bash
npm install --legacy-peer-deps
./scripts/setup-lab.sh
./scripts/reset-lab.sh
./scripts/prove-lab.sh
```

The lab is a fresh `--template blog` site on port 4332. Then open http://127.0.0.1:4332/polls-demo and http://127.0.0.1:4332/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin/plugins/polls/polls
