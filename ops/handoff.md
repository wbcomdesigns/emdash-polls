# Handoff: WB Polls (2026-10-14)

You are the one agent for this repo. Read this, then work.

## Where it stands

0.1.0 engine and kit are on branch `0.1.0`. Pull request: https://github.com/wbcomdesigns/emdash-polls/pull/17. Lab is `../emdash-lab-polls` on port 4332. Visitor walk: http://127.0.0.1:4332/polls-demo

Closed or ready to close after the verification comment: #1 #2 #14 #3 #4 #5 #10 #18 #19 #11 #12 #7 #15 #13 #8. #9 is the release gate (do not publish). #6 stays 0.2.0. #16 was proved as far as EmDash allows and stopped (see the issue).

## Start with

Wait for the Listora session to walk the pull request. Then the owner publishes. Do not merge, tag or publish from this session.

If the owner asks for listing screenshots, reset the lab, create one ordinary poll (no QA-RFT prefix), and replace `images/screenshot-*.png`.

## Not in this release

Member-created polls, a poll list page, a page per poll, categories, a colour per poll, public voter names, `<MyVotes>` (0.2.0).

## How to work

- Branch `0.1.0`. Commit per finished task. Keep pushing to pull request #17.
- Lab: `./scripts/reset-lab.sh`, `./scripts/prove-lab.sh`, `./scripts/lab-role.sh`.
- GitHub issues only. No Basecamp.
- No AI attribution. No em-dashes.

## You stop when

Every 0.1.0 task has a verification comment, the checklist last-walk line is honest, and the pull request is open. Never merge into `main`, never tag, never publish.
