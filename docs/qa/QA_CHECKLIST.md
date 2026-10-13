# QA checklist: Polls

One living list of flow-level cases. Walk all of it before every release. When you add or fix behaviour, add or change its case in the same pull request. There are no per-release QA files.

**Last walk:** 2026-10-14, 0.1.0 working tree before push, lab http://127.0.0.1:4332. Isolated Chromium. Guest, then subscriber (same lab account, role flipped), then admin. Browser: G-4, G-5, G-6, G-9 (slot + empty missing), M-9 named notice and vote, A-6 anonymous results, A-9 site attach on the demo slot, copy with `(copy)`, admin list Actions on-screen at 390, P-1 1440/768/390 guest, P-2 kit dark via color-scheme on `.wb` (host chrome stays with the lab theme), P-4 vote button 44px, P-7 names not ids. Route/HTTP and tests: G-2, G-3, G-8, G-91 (wording grep), A-10 named results (`Dev Admin` / Map), A-11 named lock, slot ladder, copy, erase. Not walked: G-1 on a members-only poll this pass, G-7 change-vote, M-2/M-3 as a second account, M-6 keyboard this pass, M-7/M-8 (0.2.0), A-1/A-3/A-5/A-7 this pass (covered earlier or by tests), A-8 as a fresh pair, in-text block (#16). One lab user.

When you walk it, replace that line with the date, the version, and three lists: cases walked in the browser, cases checked at route level only, cases not walked. Do not claim a case you did not run.

## Setup

```bash
./scripts/reset-lab.sh             # clean data, lab running
./scripts/prove-lab.sh             # route-level smoke, must pass first
./scripts/lab-role.sh subscriber   # member cases as the lowest signed-in role
./scripts/lab-role.sh admin        # back to admin
```

Three roles, in this order: guest (private window), member (subscriber), admin. A case proven only as admin is not proven. Name test data `QA-RFT ...` and reset the lab afterwards.

## Guest

| ID | Steps | Expected |
| --- | --- | --- |
| G-1 | Setting members: open a page with an open poll | Question and options show. Voting asks to sign in |
| G-2 | Request `vote`, `ballot`, `mine` directly | 401 |
| G-3 | Read a poll whose results are `after_vote` or `after_close` | No results in the response |
| G-4 | Open a closed poll with results `always` | Results show, no voting controls |
| G-5 | Use an id that does not exist | A clear not-found state, no error text |
| G-6 | Poll set to anyone: vote signed out | Vote saved. Results follow the visibility rule |
| G-7 | Poll set to anyone: vote again from the same visitor | Follows the poll's change rule. The total never counts one visitor twice |
| G-8 | Poll set to members: call `vote_guest` directly | Refused |
| G-9 | Open a post with a poll attached to it, then one without | The first shows the poll. The second shows nothing, with no empty box |
| G-91 | Change three phrases in the wording file (a button, an empty state, an error), rebuild | Each change shows everywhere that phrase is used. No English left on screen that is not in the file |

## Member (subscriber role)

| ID | Steps | Expected |
| --- | --- | --- |
| M-1 | Vote in a single-choice poll | Choice saved. Results show if allowed |
| M-2 | Vote in a multiple-choice poll with two options | Both saved, each counted once |
| M-3 | Vote again where change is allowed | Old choice replaced. Totals stay consistent |
| M-4 | Vote again where change is not allowed | Refused with wording |
| M-5 | Send an option id from another poll, or another member's id | Refused, ignored |
| M-6 | Vote using only the keyboard | Works. Focus ring visible |
| M-7 | Open My votes | Polls voted in, with the choice |
| M-8 | Delete my votes (two clicks) | List empties. Poll totals drop |
| M-9 | Vote in a named poll | The notice is visible before voting. The vote is saved with your name |

## Admin

| ID | Steps | Expected |
| --- | --- | --- |
| A-1 | Create a poll with one option | Refused: at least two options |
| A-2 | Create, then open a poll | It appears on the site |
| A-3 | Edit options on a poll that has votes | Labels can change. Removing an option is refused |
| A-4 | Close a poll | Voting stops. Results follow the visibility rule |
| A-5 | Delete a poll (two steps) | Poll and its votes are gone |
| A-6 | Open results | Bars, counts and totals match the ballots |
| A-7 | Set a close time in the past, load the poll | It shows as closed |
| A-8 | Create one poll for anyone and one for members | Each behaves as set. The list shows which is which |
| A-9 | Attach one poll to a post, one to all posts, one site-wide | The post shows its own poll. Other posts show the collection poll. Pages show the site-wide poll |
| A-10 | Open results of a named poll and of an anonymous one | Named: members and choices listed. Anonymous: totals only, no names anywhere |
| A-11 | Try to switch a poll with votes from anonymous to named | Refused |

## Presentation, every screen

| ID | Steps | Expected |
| --- | --- | --- |
| P-1 | Every screen at 1440, 768 and 390 | No sideways scroll |
| P-2 | Switch the system to dark mode | All text readable. No white panel on a dark page |
| P-3 | Measure text contrast | Body text 4.5:1, large text 3:1 |
| P-4 | Measure buttons, inputs, tabs | At least 40px tall |
| P-5 | Tab through every control | Everything reachable, focus ring visible, forms usable by keyboard |
| P-6 | Empty, loading and error states | Each list has an empty state with a next step. A failed request shows a message |
| P-7 | Look for raw ids | No screen shows an id where a name belongs |
| P-8 | View page source as two different visitors | Kit markup is identical. No member data in the HTML |

## Known gaps

- Formal WP QA files are still thin: SURFACES exists. OWNER_INVENTORY, CORE_PATHS, qa-config, fixtures and ROLE_MATRIX are not here. EmDash plugins use GitHub issues, not Basecamp.
- One lab user. Subscriber is the same account as admin with the role flipped.
- Closed polls have no Open in the row menu. That matches the current admin rules.
- My votes (`<MyVotes>`) is 0.2.0 (#6).
- In-text Poll block (#16): trusted companion activates (`polls-block` in plugin state). Registry install is unchanged. A live list of polls cannot be filled from static Block Kit fields. The post editor was not proven to show Poll in the slash menu. Reported on #16.
- Admin Actions control is about 36px tall (EmDash table chrome). Kit vote buttons meet 40px.
- Registry screenshots still need a clean reset without QA-RFT names before publish.
