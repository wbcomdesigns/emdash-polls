# Handoff: WB Polls (2026-10-19)

Live: **0.3.0** on the EmDash registry as `@vapvarun.bsky.social/polls`.

Public page: https://plugins.emdashcms.com/plugins/@vapvarun.bsky.social/polls

Lab is `../emdash-lab-polls` on port 4332 (fresh `--template blog`, EmDash 1.3.0).

## Next

- 0.3.1 is on branch `0.3.1` with a pull request into main: guest votes need a host-given visitor address (owner decision 2026-10-16), a per-voter lock on votes, the Set up visitor pages card, `scripts/add-to-site.sh`, and install guides on the shared Before you install text. Waiting for the owner's QA, then the owner says publish.
- Open question for the owner: the public `slot` route can return a poll attached to an unpublished entry when its id is known. Checking the entry needs the `content:read` capability, which the owner has to agree to.
- Do not republish an existing version: a registry release cannot be changed.

## How to work

GitHub issues only. Branch named for the next version. Never merge, tag or publish unless the owner asks. No AI attribution. No em-dashes.
