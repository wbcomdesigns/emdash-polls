# Surfaces: Polls

Behaviour rows for the 0.1.0 walk. Re-verify with the grep in the last column.

| Behaviour | Public kit | Guest routes | Member routes | Admin list | Admin form | Editor panel | Email | REST other |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Show a poll | `site-kit/components/Poll.astro` `get?id=` / `get?latest=1` | same | same | Poll column `src/admin.ts` | n/a | `src/editor.ts` | none | none |
| Vote | `Poll.astro` form → `vote_guest` or `vote` | `src/vote.ts` `handleVoteGuest` | `src/vote.ts` `handleVote` | vote count in Poll column | n/a | n/a | none | none |
| Already voted / change | `Poll.astro` hides form unless `allow_change` | `ballot_guest` | `ballot` | n/a | allow-change toggle | n/a | none | none |
| Members only | kit sign-in line | `vote_guest` → MEMBERS_ONLY | `vote` | Who in Poll column | Who can vote select | n/a | none | none |
| Closed | kit "This poll is closed." no form | get + vote refuse NOT_OPEN | same | Close action | close time | n/a | none | none |
| Not found | kit "This poll is not available." | get → NOT_FOUND | same | gone toast | "That poll is gone." | n/a | none | none |
| Create / one option | n/a | n/a | n/a | n/a | `src/admin.ts` save → "Add at least two answers." | n/a | none | none |
| Open / close / delete | latest get after open | n/a | n/a | row Actions `src/admin.ts` `moderate` | n/a | n/a | none | none |
| Attach / slot | `PollSlot.astro` → `slot` | `src/plugin.ts` `slot` / `src/lib/polls.ts` `readSlot` | same | attach line in Poll column | Where it shows | attach / remove on the page | none | none |
| Named / anonymous | kit named notice | guest vote stores no name | member vote stores `member_name` when named | Named / Anonymous in Poll column | named toggle, locked after votes | n/a | none | none |
| Admin results | n/a | n/a | n/a | Results action | n/a | n/a | none | `renderResults` bars + named table |
| Copy | n/a | n/a | n/a | Copy action | n/a | n/a | none | `copyPoll` new draft, `(copy)` in the question |
| Wording | `site-kit/lib/polls-strings.ts` only | error codes | error codes | admin English is not in the file | same | same | none | `phrase()` |
| My votes | `MyVotes.astro` | n/a | `GET/DELETE mine` | n/a | n/a | n/a | none | `handleMine` lists and erases only the caller |

Grep to re-verify:

```bash
rg -n "handleVoteGuest|handleVote|MEMBERS_ONLY|Add at least two answers|Poll opened|Poll deleted|readSlot|copyPoll|polls-strings" src site-kit
rg -n "data-wbp|vote_guest|ballot_guest|PollSlot" site-kit
```
