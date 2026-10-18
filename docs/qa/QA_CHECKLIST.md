# QA checklist: Polls

One living list of flow-level cases. Walk all of it before every release. When you add or fix behaviour, add or change its case in the same pull request. There are no per-release QA files.

**Last walk:** 2026-10-19 (second pass), 0.3.1 branch, EmDash 1.3.1. Lab http://127.0.0.1:4332 (fresh `--template blog` on 1.3.1, file install) and the scratch site upgraded from 1.3.0 to 1.3.1 with WB Polls 0.3.0 from the registry plus the 0.3.1 kit. Browser: G-10 (Always poll shows bars and a neutral sign-in note), after_vote and after_close stay hidden for guests, member before voting sees only the form (G-92), G-13, G-15, G-16, A-16 to A-19 at 1440, 768 and 390, light and dark. Route or shell only: G-14, BUSY not counted, add-to-site.sh (tests/add-to-site.test.sh). Tests: 69 vitest plus the shell checks. Not walked: G-1, G-7, second member, in-text block, Admin Menus link, Cloudflare, a fresh 1.3.1 registry install (the registry list stayed empty on that site). Developer walk, not a second-person QA PASS.

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
| G-92 | Open poll, results Always, before voting | One list of answers. No empty 0% chart above the same answers |
| G-93 | Page with a poll slot and no matching poll | Nothing. No empty bordered box |
| G-10 | Host gives no visitor address (Node, no `trustedProxyHeaders`): open a post with an Anyone poll | Answers listed and "Sign in to vote." with a Sign in link. No Vote button. `vote_guest` answers `GUEST_UNAVAILABLE` and stores nothing |
| G-11 | Same host, `trustedProxyHeaders: ["x-forwarded-for"]` and the header sent | Guest votes once; a second vote from that address is refused |
| G-12 | Guest console on a post with a poll | Exactly one 401, from `ballot` (documented as expected). One 401 from `mine` on `/account/votes` |
| G-13 | Post template with the two slots from `add-to-site.sh` (`../../components/PollSlot.astro`) | Page renders, poll in the slot that matches its Position |
| G-14 | Several votes for different answers sent at once by one voter on a one-choice poll | One stored choice; the others get ALREADY_VOTED, BUSY or RATE_LIMITED |
| G-15 | Results Always, guest who cannot vote (no-address host or members-only poll) | Bars and counts show, then a neutral (not green) "Sign in to vote." note. After a vote and After close polls still hide results |
| G-16 | Engine 0.3.0 with the 0.3.1 kit, guest | Sign-in note and results, no Vote button, never "Something went wrong". Engine 0.3.1 with the 0.3.0 kit: a guest vote on a no-address host says "Something went wrong"; the Polls screen shows the setup card again so the owner copies the new kit |

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
| A-4 | Close a poll | Voting stops. Results follow the visibility rule. The slot still shows the poll. Actions still has Open |
| A-5 | Delete a poll (two steps) | Poll and its votes are gone |
| A-6 | Open results | Bars, counts and totals match the ballots |
| A-7 | Set a close time in the past, load the poll | It shows as closed |
| A-8 | Create one poll for anyone and one for members | Each behaves as set. The list shows which is which |
| A-9 | Attach one poll to a post, one to all posts, one site-wide | The post shows its own poll. Other posts show the collection poll. Pages show the site-wide poll |
| A-10 | Open results of a named poll and of an anonymous one | Named: members and choices listed. Anonymous: totals only, no names anywhere |
| A-11 | Try to switch a poll with votes from anonymous to named | Refused |
| A-12 | New poll, Where it shows: one content type | The next field lists content types by name. Nothing is typed |
| A-13 | New poll: pick an open day in the date picker and 09:30 in the time list, save, edit again | Day and 09:30 come back. The list shows Scheduled. Clearing the day and saving shows Draft. Nothing is typed |
| A-14 | Attach an open poll to all posts, then open a post in the editor and expand the Poll panel | The panel says "Visitors see a shared poll" and names it, not "No poll here". The existing-poll list reads "Choose a poll" |
| A-15 | Template has `<PollSlot position="above">` before the content and `position="below"` after. Set a poll to Above, then to Below | Only the matching slot shows the poll; the other renders nothing. A template with one slot and no position shows the poll either way |
| A-16 | Fresh install, open Polls | "Set up visitor pages" card with the `mktemp -d` clone command for the installed tag, My votes address, Install guide link. "Visitor pages are set up" hides it for good and leaves one line plus the guide link |
| A-17 | Host gives no visitor address, open Polls | One line: guests cannot vote here, with the Guest voting guide link. Not shown when the host gives an address |
| A-18 | Polls screen at 1440, 768 and 390 with the setup card | Six-line command fully visible at 1440 and 768, `main` does not scroll sideways. At 390 the clone address line is cut and the guide link under it ("Copy it from the install guide on a phone") gives the full command |
| A-19 | Press Visitor pages are set up, then Show the setup steps again; update the plugin | The card hides, comes back on Show the setup steps again, and comes back after a version change. The list names a content type (Pages), not "A content type" |

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

- QA owner files are in `docs/qa/` and `audit/ROLE_MATRIX.md`. EmDash plugins use GitHub issues, not Basecamp.
- The lab has one bypass account (`dev@emdash.local`). Subscriber vs admin is `scripts/lab-role.sh`. `bin/qa-fixtures.sh` inserts a second subscriber row for named data; that account has no login bypass.
- Closed polls can be opened again from the row menu.
- My votes ships as `<MyVotes>` plus `/account/votes`. Walked as guest (sign-in) and member (list + two-click erase). Not an independent QA PASS.
- In-text Poll block (#16): trusted companion activates (`polls-block` in plugin state). Registry install is unchanged. A live list of polls cannot be filled from static Block Kit fields. The post editor was not proven to show Poll in the slash menu. Reported on #16.
- Admin Actions control is about 36px tall (EmDash table chrome). Kit vote buttons meet 40px.
- Registry screenshots are taken from a reset lab after `prove-lab.sh` seeds the ordinary demo polls (colour, extras, name, layout).
