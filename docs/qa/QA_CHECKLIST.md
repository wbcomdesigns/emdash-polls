# QA checklist: Polls

One living list of flow-level cases. Walk all of it before every release. When you add or fix behaviour, add or change its case in the same pull request. There are no per-release QA files.

**Last walk:** 2026-10-13, 0.1.0 in progress. A-1, A-2, A-4, A-5 checked at route and lab HTTP level as admin. Guest 401 and subscriber 403 on the admin route. Playwright MCP was locked by another session, so 1440 / 390 / light / dark were not seen. A-3 checked in tests only. Other cases not walked.

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

None recorded yet. List anything a release ships without, here, in plain words.
