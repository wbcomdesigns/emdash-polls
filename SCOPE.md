# Polls: scope

This file is the contract for the plugin. Code, tests, docs and cards all follow it. If something here is wrong, change it here first, in the same pull request as the code.

## Purpose

Let the owner ask a question, let signed-in members vote once, and show results the way the owner chooses.

**Who it is for:** Blogs, communities and product sites that want quick audience input without a form builder.

**WordPress source:** WB Polls (`~/dev/repos/buddypress-polls`) for vocabulary only. Its BuddyPress activity features do not apply. Do not copy PHP.

**Brand:** Logos: `~/Documents/brand logos/wb-polls/`. Use the mark, never boxed in a tile.

## Fits every kind of site

This plugin must work for any site owner, not one niche. Judge every screen and every word against this table.

| Kind of site | How the owner uses it |
| --- | --- |
| Blog or magazine | Reader polls inside or beside an article |
| Business or service site | Ask visitors which service or time slot they want |
| Shop or product site | Which colour or product should we make next |
| Community or membership | Member votes and quick decisions |
| Docs or SaaS | Which feature or integration matters most |
| Portfolio or agency | Audience pick between two designs |

**Member accounts:** Needs member sign-in today. A site with no member accounts cannot run a poll until the open decision below is settled.

How it stays general:

- A poll is placed by a component with an id, so it works on any page of any site type
- Nothing depends on a collection or on any other plugin

**Open decision for the owner: who can take part.** Most EmDash sites have no member sign-up. If this plugin only works for signed-in members, it does not work for those sites. The proposal is one setting, "Who can take part": signed-in members only, or anyone. "Anyone" means one entry per visitor (a salted hash of the IP, never the IP itself), an hourly limit per visitor, and for written content, always held for approval. Until the owner decides, build members-only exactly as written here, and keep the identity check in one place so the guest path can be added without touching the routes.

## In scope for 0.1.0

- Owner creates a poll: question, 2 to 10 options, single or multiple choice
- Poll states: draft, open, closed. Optional close time that closes it automatically on read
- One ballot per member per poll. A member can change their vote while the poll is open (setting per poll)
- Results visibility per poll: always, after voting, or after the poll closes
- Drop-in `<Poll id>` component and `<Poll latest />` for the newest open poll
- Drop-in `<MyVotes>` for an account page, with delete-my-votes
- Admin: poll list with status and vote totals, create and edit form, open / close / delete, results view

## Out of scope

Do not build these. If a card seems to need one, stop and ask the owner.

- Guest voting
- Image options
- Ranked or weighted voting
- Poll comments
- Embedding a poll inside post content
- Scheduling a poll to open later
- Export of votes
- Any paid or Pro feature
- Email sending (the host may have no mail configured)
- Portable Text blocks or anything that needs a native plugin
- Injecting scripts, styles or HTML into pages from the plugin

## Roles

| Role | Can do |
| --- | --- |
| Guest | Everything marked `public` in the routes table |
| Member | Signed in at subscriber role or above. Everything marked `member`, acting only on their own data |
| Admin | Everything marked `admin`, from the EmDash admin |

## Capabilities

None. This plugin reads and writes only its own storage.

Ask for nothing more without the owner's agreement: every capability is shown to the site owner at install.

## Data schema

### `polls`

Row id: Random id made at create time. Indexes: `status`, `createdAt`.

| Field | Type | Notes |
| --- | --- | --- |
| `question` | string | Up to 200 characters |
| `options` | array | `[{ id, label }]`, 2 to 10. Option ids are stable once the poll has votes |
| `multiple` | boolean | Allow more than one choice |
| `allow_change` | boolean | Member may change their vote while open |
| `results` | string | `always`, `after_vote` or `after_close` |
| `status` | string | `draft`, `open` or `closed` |
| `closes_at` | string | ISO time or empty |
| `createdAt` | string | ISO time |

### `votes`

Row id: `<pollId>:<memberId>:<optionId>`. One row per chosen option. Indexes: `poll`, `poll_option`, `member_id`.

| Field | Type | Notes |
| --- | --- | --- |
| `poll` | string | Poll id |
| `poll_option` | string | `<pollId>:<optionId>`. Counted with `storage.count` for tallies |
| `member_id` | string | From `routeCtx.user.id` |
| `createdAt` | string | ISO time |

## Settings

None.

## Routes

Base: `/_emdash/api/plugins/polls/<name>`.

| Route | Who | Methods | Input | Returns |
| --- | --- | --- | --- | --- |
| `health` | public | GET | - | `ok`, version, open poll count |
| `get` | public | GET | `id` or `latest=1` | Poll (question, options, multiple, status, closes_at) and `results` when visible to a guest |
| `ballot` | member | GET | `id` | The caller's own choices and the results they are allowed to see |
| `vote` | member | POST | `id`, `choices` (option ids) | Saved choices and results if now visible |
| `mine` | member | GET, DELETE | - | GET: polls the caller voted in. DELETE: erase all own votes |
| `admin` | admin | POST | Block Kit | List, form, results |

`member` means a private route with `permission: MEMBER`. `admin` means a private route with no permission set. A `public` route never receives a user.

## Hooks

None.

## Admin screens

| Page | What it shows |
| --- | --- |
| `/polls` | Table: question, status, total votes, closes. Row menu: Edit, Open, Close, Results, Delete (two-step) |
| `/edit` | Form: question, options as a textarea with one per line, choice type, results visibility, allow change, close time |

## Site kit

| File | What it is |
| --- | --- |
| `site-kit/components/Poll.astro` | `<Poll id />` or `<Poll latest />` |
| `site-kit/components/MyVotes.astro` | `<MyVotes />` |
| `site-kit/styles/polls.css` | Option rows and result bars |
| `site-kit/lab/polls-demo.astro` | Lab page with one poll of each kind |

Plus the two shared files every Wbcom plugin kit carries: `site-kit/lib/wbcom-kit.ts` and `site-kit/styles/wbcom-base.css`.

## Screens and their states

A screen is done when every state listed here has been seen in a browser at 1440, 768 and 390, in light and dark.

| Screen | States that must exist |
| --- | --- |
| Poll component | Loading, poll not found, open and not voted, open and voted, results hidden until vote, closed, guest sign-in prompt, busy, error |
| Results | Bar per option with percent and count, the member's own choice marked, total votes, readable without colour |
| My votes | Loading, empty, list, two-click delete, guest sign-in prompt |
| Admin list | Empty state with a Create button, status wording, vote totals |
| Admin form | Validation messages for fewer than 2 or more than 10 options and an empty question |

## Risks and open questions

- Tallies come from `storage.count` per option: up to 10 counts per poll view. Confirm the cost, and cache the tally on the poll row only if it is a problem
- Editing options after votes exist would orphan votes. Lock option ids once a poll has votes: labels can change, options cannot be removed
- `closes_at` is checked on read. There is no scheduler, so a poll closes the next time anyone loads it
- Block Kit `repeater` renders nothing inside a form. Options are a textarea
- Results `after_vote` must be enforced on the server. A guest request must not receive hidden results
