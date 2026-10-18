# Polls: scope

**Status: LOCKED on 2026-10-13.** Scope and decisions were agreed with the owner. An agent does not add options or features. If a task cannot be done as written, stop, say why on its issue, and wait for the owner.

This file is the contract for the plugin. Code, tests, docs and cards all follow it. If something here is wrong, change it here first, in the same pull request as the code.

## Corrections after reading EmDash's own guides (2026-10-13)

**This section wins over any older line below that disagrees with it.**

- **Attaching a poll from the editing screen is a documented plugin surface** (`admin.editorPanels`, saved-entry panels). An ordinary panel gets the saved entry's identity, which is all this needs. While proving it, also try a field widget (`admin.fieldWidgets`): a "Poll" field an owner adds to a content type. Report which is plainer for the owner; build one, not both, unless the owner says otherwise.
- **Dashboard card** (`admin.widgets`): open polls with their vote totals.
- **Visitors first:** a visitor is never locked out by hosting. Trusted visitor address where EmDash supplies it, written content always approved first. (Changed 2026-10-16, see below: with no address, guest votes are refused and guests sign in.)
- **Member account list (`<My...>`):** not in 0.1.0. Moved to 0.2.0. The erase-by-person function stays, as an admin action.
- **Block inside post text:** only with a trusted install. The registry install is the whole product without it.
- **Open and close times** are shown in the site's time zone and date format, from EmDash's site settings.
- **Capabilities:** `schema:read` so the poll form can list content types by name. Nothing else.

## Purpose

Let the owner ask a question, let signed-in members vote once, and show results the way the owner chooses.

**Who it is for:** Blogs, communities and product sites that want quick audience input without a form builder.

**WordPress source:** WB Polls (`~/dev/repos/buddypress-polls`) for vocabulary only. Its BuddyPress activity features do not apply. Do not copy PHP.

**Brand:** WB Polls, teal. Full kit (mark, wordmark, horizontal, square, each in light, dark and white, plus PNGs and social banners) and the brand sheet: `~/Documents/brand logos/wb-polls/`. `icon.png` and `images/banner.png` in this repo come from it. Rebuild with the pipeline in `~/Documents/brand logos/_render-src/`, never by hand. The lockup tagline names WordPress, so use the mark and the no-tagline lockup on EmDash.

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

**Member accounts:** Works with or without member accounts. The owner chooses who can take part.

How it stays general:

- A poll is placed by a component with an id, so it works on any page of any site type
- Nothing depends on a collection or on any other plugin
- Every visitor-facing word is in one wording file, so a non-English site or a site with its own vocabulary changes it in one place

**Decided by the owner on 2026-10-13: the site owner chooses who can take part.** One setting: signed-in members only, or anyone. For a guest: one entry per visitor, identified by a salted hash of the IP (never the IP itself, never a cookie the visitor can clear to vote again within the hour limit), an hourly limit per visitor, a honeypot field on every guest form, and written content always held for approval. Guests have no account, so they have no "My ..." list and cannot erase their entries themselves; the owner removes them in admin. **Changed by the owner on 2026-10-16, after the security review:** if the host supplies no trusted visitor address (any host but Cloudflare, unless the site sets `trustedProxyHeaders`), guest votes are refused with `GUEST_UNAVAILABLE` and nothing is stored. The kit shows the answers and a sign-in link, `health` reports `guestWrites: false`, and the Polls screen says in one line that guests cannot vote on this hosting. A browser-sent id is never used to count a guest. An IPv6 guest is counted by its /64. A visitor is never locked out by hosting (owner direction 2026-10-13: visitors first, about nine in ten EmDash sites have visitors only). Member routes stay private routes using `routeCtx.user`. Guest routes are separate public routes: never merge the two paths.

## Decisions made with the owner

Settled. Do not reopen these in code review. Dated 2026-10-13 unless noted.

| Question | Decision |
| --- | --- |
| Who can take part | The site owner chooses: signed-in members only, or anyone. Default is anyone. |
| How a poll gets onto a page | Both. The owner attaches a poll in admin (to one page, to every entry of a collection, or site-wide), and a developer can also place a specific poll by id. |
| Who sees how people voted | The owner chooses per poll: anonymous (totals only) or named. Voters are told before they vote. Guests are always anonymous. |
| Wording and language | One wording file per plugin kit. Every visitor-facing phrase lives there, so an owner can translate or reword the plugin by editing one file. |
| Attaching a poll | From a Poll panel on the post or page editing screen (to be proven first), and from the poll form for a whole content type or the whole site. No block inside article text: this kind of plugin cannot add one. |
| Editing after votes | Wording only. Answers cannot be added, removed or reordered, and the choice type is locked. |
| Several polls for one place | Most specific wins (page, then content type, then site), then newest. The list warns when a poll is hidden. |
| Open time | Optional. A poll can open by itself. Picked with a date picker and a time list, in UTC (a plugin cannot read the site time zone). |
| Position | Per poll: above or below the content. |
| Numbers | Per poll: percent and count, or percent only. |
| Copy a poll | In 0.1.0. |
| Past polls page, download of votes | Not in 0.1.0. |
| Members creating polls | No. EmDash is not member-focused for now: the plugin is about what the admin can do. Visitors and members vote; only the admin creates and manages polls. |
| Poll list page, a page per poll, poll categories, a colour per poll | No. |
| Who sees voter names | The admin only. |
| Thank-you message | Yes, optional, per poll. |
| Long lists and setup | Next, Previous and find in admin. Developer guide plus one command. |

## Against the free WordPress plugin (WB Polls Lite), checked 2026-10-13

| Free WordPress feature | Here |
| --- | --- |
| Text polls, single or several choices, guest voting, start and end dates, result bars, dark mode | Yes |
| Placed on any page | Yes: editing-screen panel, slots, in-text block with a trusted install |
| Members create and manage polls, admin approval, role limits on creating | No, by owner decision: admin-only for now |
| Poll list page, page per poll, categories, colour per poll | No, by owner decision |
| Voters shown publicly | No. Admin only |
| BuddyPress activity and group polls | No equivalent on EmDash |

Paid WordPress features (image, video and audio answers, surveys, email capture, chart types, export, notices, comments on votes, voter-added answers) stay out, except the per-poll thank-you message.

## In scope for 0.1.0

- Owner creates a poll: question, 2 to 10 options, single or multiple choice
- Poll states: draft, open, closed. Optional close time that closes it automatically on read
- One ballot per member per poll. A member can change their vote while the poll is open (setting per poll)
- Results visibility per poll: always, after voting, or after the poll closes
- Drop-in `<Poll id>` component and `<Poll latest />` for the newest open poll
- Admin: poll list with status and vote totals, create and edit form, open / close / delete, results view
- Setting per poll "Who can vote": signed-in members only, or anyone. A guest gets one ballot per visitor per poll
- Attach a poll in admin: to one chosen entry, to every entry of a collection, or site-wide. The site template carries one `<PollSlot>` added once at install
- Place a specific poll anywhere with `<Poll id>` for sidebars and special layouts
- Per poll: anonymous or named. A named poll says so above the options, and the owner can see each signed-in member's choice in admin. Guests are never named
- One wording file, `site-kit/lib/polls-strings.ts`: every phrase a visitor can see (buttons, labels, messages, empty states, errors shown to visitors). Components and pages take their text only from it

## Out of scope

Do not build these. If a card seems to need one, stop and ask the owner.

- Image options
- Ranked or weighted voting
- Poll comments
- Export of votes
- Any paid or Pro feature
- Email sending (the host may have no mail configured)
- Portable Text blocks or anything that needs a native plugin
- Injecting scripts, styles or HTML into pages from the plugin
- A poll in the middle of article text (needs a native plugin block). The slot goes above or below the content
- Changing a poll from anonymous to named after it has votes
- Translating the admin screens, and switching language per visitor. The wording file holds one language

## Roles

| Role | Can do |
| --- | --- |
| Guest | Everything marked `public` in the routes table |
| Member | Signed in at subscriber role or above. Everything marked `member`, acting only on their own data |
| Admin | Everything marked `admin`, from the EmDash admin |

## Capabilities

`schema:read`. Used to list the site's content types by name on the poll form. The plugin still stores only its own polls and votes.

Ask for nothing more without the owner's agreement: every capability is shown to the site owner at install.

## Data schema

### `polls`

Row id: Random id made at create time. Indexes: `status`, `createdAt`, `attach_key`.

| Field | Type | Notes |
| --- | --- | --- |
| `question` | string | Up to 200 characters |
| `options` | array | `[{ id, label }]`, 2 to 10. Option ids are stable once the poll has votes |
| `multiple` | boolean | Allow more than one choice |
| `allow_change` | boolean | Member may change their vote while open |
| `results` | string | `always`, `after_vote` or `after_close` |
| `status` | string | `draft`, `open` or `closed` |
| `closes_at` | string | ISO time or empty |
| `thanks` | string | Optional line shown after voting. Plain text, up to 140 characters |
| `opens_at` | string | ISO time or empty. A draft with a future time shows as Scheduled and opens on read |
| `position` | string | `above` or `below` the content when attached. Default `below` |
| `numbers` | string | `full` (percent and count) or `percent`. Admin always shows counts |
| `createdAt` | string | ISO time |
| `who` | string | `members` or `anyone`. Default `anyone` |
| `named` | boolean | True for a named poll. Locked once the poll has votes |
| `attach` | string | `none`, `entry`, `collection` or `site` |
| `attach_key` | string | `<collection>:<entryId>` for `entry`, the collection slug for `collection`, empty otherwise. Indexed |

### `votes`

Row id: `<pollId>:<memberId>:<optionId>`. One row per chosen option. A guest's row id is `<pollId>:v-<visitorHash>:<optionId>`. Indexes: `poll`, `poll_option`, `member_id`.

| Field | Type | Notes |
| --- | --- | --- |
| `poll` | string | Poll id |
| `poll_option` | string | `<pollId>:<optionId>`. Counted with `storage.count` for tallies |
| `member_id` | string | From `routeCtx.user.id` |
| `createdAt` | string | ISO time |
| `visitor` | string | Guests only: SHA-256 of the IP plus a per-site salt. Empty for members |
| `member_name` | string | Only on a named poll: the member's display name at vote time. Empty on anonymous polls and for guests |

## Settings

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `who` | string | `anyone` | `members` or `anyone`. Per poll, stored on the poll |

## Routes

Base: `/_emdash/api/plugins/polls/<name>` on a local install. A registry install uses the id EmDash assigns (`r_` + 16 characters). The kit tries that id first.

| Route | Who | Methods | Input | Returns |
| --- | --- | --- | --- | --- |
| `health` | public | GET | - | `ok`, version, open poll count, `guestWrites` (false when the host gives no visitor address) |
| `get` | public | GET | `id` or `latest=1` | Poll (question, options, multiple, status, closes_at), `guestWrites`, and `results` when visible to a guest |
| `slot` | public | GET | `collection`, `id` | The open poll attached to this entry, else to its collection, else site-wide, else nothing |
| `ballot` | member | GET | `id` | The caller's own choices and the results they are allowed to see |
| `vote` | member | POST | `id`, `choices` (option ids) | Saved choices and results if now visible. One compare-and-set lock per poll and voter: a second vote sent at the same moment gets `BUSY` |
| `mine` | member | GET, DELETE | - | GET: polls the caller voted in. DELETE: erase all own votes |
| `vote_guest` | public | POST | `id`, `choices`, honeypot field | Saved choices and results if now visible. Refused when the poll is members only, and with `GUEST_UNAVAILABLE` when the host gives no visitor address |
| `ballot_guest` | public | GET | `id` | The visitor's own choices and the results they may see |
| `admin` | admin | POST | Block Kit | List, form, results |

`member` means a private route with `permission: MEMBER`. `admin` means a private route with no permission set. A `public` route never receives a user.

## Hooks

None.

## Admin screens

| Page | What it shows |
| --- | --- |
| `/polls` | Table: question, status, who can vote, anonymous or named, where it shows, total votes. Row menu: Edit, Open, Close, Results, Copy, Delete (two-step). 25 a page, Next, Previous, find by question |
| Editing screen panel | On every post and page: the attached poll, pick an existing one, create one, remove. Issue #14 |
| `/edit` | Form: question, options (one per line), choice type, who can vote, anonymous or named, where it shows, results visibility, allow change, close time |

## Site kit

| File | What it is |
| --- | --- |
| `site-kit/components/Poll.astro` | `<Poll id />` or `<Poll latest />` |
| `site-kit/components/PollSlot.astro` | `<PollSlot collection id />`. Shows whichever poll the owner attached, or nothing |
| `site-kit/components/MyVotes.astro` | `<MyVotes />`. Polls the signed-in member voted in, and a two-click erase |
| `site-kit/styles/polls.css` | Option rows and result bars |
| `site-kit/lab/polls-demo.astro` | Lab page with one poll of each kind |
| `site-kit/lab/polls-mine.astro` | Lab page that mounts My votes |
| `site-kit/lib/polls-strings.ts` | The wording file. The only place visitor-facing text is written |

Plus the two shared files every Wbcom plugin kit carries: `site-kit/lib/wbcom-kit.ts` and `site-kit/styles/wbcom-base.css`.

## Screens and their states

A screen is done when every state listed here has been seen in a browser at 1440, 768 and 390, in light and dark.

| Screen | States that must exist |
| --- | --- |
| Poll component | Loading, poll not found, open and not voted, open and voted, results hidden until vote, closed, guest sign-in prompt, busy, error |
| Results | Bar per option with percent and count, the member's own choice marked, total votes, readable without colour |
| Admin list | Empty state with a Create button, status wording, vote totals |
| Admin form | Validation messages for fewer than 2 or more than 10 options and an empty question |
| Poll slot | Renders nothing at all when no poll is attached: no heading, no gap |
| Named poll | A plain line above the options: your choice will be visible to the site owner. Shown before voting, not after |
| Admin results on a named poll | A list of members and their choices under the bars. On an anonymous poll that list does not exist |
| My votes | Sign-in prompt for guests, empty list with a next step, list of questions and chosen labels (no ids), two-click erase |

## Risks and open questions

- Tallies come from `storage.count` per option: up to 10 counts per poll view. Confirm the cost, and cache the tally on the poll row only if it is a problem
- Editing options after votes exist would orphan votes. Lock option ids once a poll has votes: labels can change, options cannot be removed
- `closes_at` is checked on read. There is no scheduler, so a poll closes the next time anyone loads it
- Block Kit `repeater` renders nothing inside a form. Options are a textarea
- Results `after_vote` must be enforced on the server. A guest request must not receive hidden results
- Guest routes are public writes. Per-visitor limit, honeypot, length caps, and refuse when the host gives no IP. Never trust a visitor id from the request: derive it from the request's IP on the server
- Named polls hold personal data: who chose what. Erase (`mine` DELETE) must remove it, and an anonymous poll must store no name at all
- Slot lookup order is entry, then collection, then site. Only one poll shows. If two polls target the same place, the newest open one wins: say so in the admin form
- Messages that come back from a route (for example a refusal) reach the visitor too. Routes return a stable `code`; the kit maps codes to phrases from the wording file and never prints the route's own English message

**Owner decision 2026-10-13:** the member account piece (My votes / My reviews) moves to 0.2.0. EmDash is not member-focused for now. Erase-by-person stays in 0.1.0 as an admin action.
