# Owner inventory: Polls

What a site owner can see and set. Re-read before a card walk. EmDash has no `owner-inventory.py`; this list is from the admin form, kit, and public routes.

Last updated: 2026-10-14 (0.2.0 in progress)

## Admin pages

| Page | URL | What the owner does |
| --- | --- | --- |
| Polls list | `/_emdash/admin/plugins/polls/polls` | Find, Create, row Actions (Edit, Open, Close, Results, Copy, Delete) |
| New / edit poll | `/_emdash/admin/plugins/polls/edit` | Write the question and answers, set who / named / results / times / attach |
| Results | list Actions → Results | Bars, totals, named names, erase one member |
| Dashboard widget | `/_emdash/admin` | Open polls and vote counts |
| Editor Poll panel | post / page editor | Attach or remove a poll on that entry |

## Options the owner sets (defaults)

| Control | Default | Notes |
| --- | --- | --- |
| Question | empty | Required |
| Answers (one per line) | empty | At least two |
| Allow more than one answer | off | Locked after votes |
| Who can vote | Anyone | Anyone or members |
| Show each member's choice | off | Locked after votes |
| When to show results | Always | always / after_vote / after_close |
| Members may change their vote | off | Only while open |
| Open time | empty | Draft until then, or open now |
| Close time | empty | Closes on read when past |
| Thank-you line | empty | After vote |
| Where it shows | Not attached | none / site / collection / entry |
| Content type | empty | Pick by name when attach is a content type |
| Position | Below the content | Kit / slot |
| Numbers | Percent and count | or percent only |

## Customer-facing templates

| Surface | File | When it shows |
| --- | --- | --- |
| Poll | `site-kit/components/Poll.astro` | Owner drops it on a page with `id` or `latest` |
| Poll slot | `site-kit/components/PollSlot.astro` | Page / content type / site ladder |
| My votes | `site-kit/components/MyVotes.astro` | Owner drops it on an account page |
| Visitor wording | `site-kit/lib/polls-strings.ts` | Every visitor phrase |

## Emails

None. The plugin does not send mail.

## Public routes

`health`, `get`, `slot`, `vote_guest`, `ballot_guest`. Member: `vote`, `ballot`, `mine` (GET list, DELETE erase own). Admin: `admin`, `editor_poll`.

## Activation artifacts

Storage collections `polls` and `votes`. No pages created on install.
