# Changelog

Versions match `package.json`, the git tag and the registry release. Newest first.

## [0.5.0]

Every poll page, vote and admin screen now fits Cloudflare's limit of 10 requests per plugin call. Copy the kit again after you update.

- New      - Each poll keeps a running total, updated in the same step as the vote, so results show in one read on any size of poll.
- New      - Results has Recount votes, which counts a poll again from the stored votes a few answers at a time.
- New      - A poll from an earlier version is counted the first time it is opened, and shows "Results are being counted" until every answer is counted.
- Improve  - Deleting a poll hides it everywhere at once, and its votes, names included, are removed a hundred at a time as you open admin screens.
- Improve  - Delete my votes erases a member with votes in hundreds of polls in steps the page runs by itself.
- Improve  - A poll's open and close times are read from its dates on every view instead of being saved by the first visitor.
- Improve  - The named voters list on Results pages by member, so a member's choices never split across two pages.
- Improve  - Find by question reads up to 300 polls per search and offers Next to search older ones.
- Fix      - On Cloudflare a guest vote no longer shows "Something went wrong" after the vote was saved.
- Fix      - On Cloudflare the Polls screen, every action on it, Results, My votes and the post editor's Poll panel no longer fail with too many requests on a busy site.
- Fix      - A draft that never reached its opening time stays hidden even after its closing time passes.

## [0.4.0]

New permission: Read your content, so a poll attached to a draft stays hidden until you publish that page. You approve it once when you update.

Guest voting now needs a visitor address from the host. On Cloudflare nothing changes. On Node and other hosts without a safe `trustedProxyHeaders` setting, guests are asked to sign in. Copy the kit again after you update.

- New      - The post editor's Poll panel on a draft says the poll shows after you publish it.
- New      - The Polls screen opens with a Set up visitor pages card: the kit command for the installed version, the visitor addresses it adds, and a link to the install guide. It comes back after each update, and Show the setup steps again brings it back any time.
- New      - One command, `scripts/add-to-site.sh`, copies the kit, keeps a newer shared Wbcom file and says when it upgrades an older one, backs up any kit file you edited, and prints the template lines with their file names.
- Improve  - Install guides start with the shared Before you install steps, clone the release tag, and were checked on EmDash 1.3.1.
- Improve  - The install guide says which guest 401 in the browser console is expected, and why.
- Improve  - The polls list names the content type a poll shows on.
- Improve  - The sign-in prompt uses a neutral note style instead of the green success style.
- Improve  - A second vote sent while the first is saving no longer uses up the hourly limit.
- Fix      - The PollSlot snippet names `src/pages/posts/[slug].astro` and imports `../../components/PollSlot.astro`, the path that works on the blog template.
- Fix      - Vote buttons use the theme's own brand colours in dark mode (shared kit styles 4) and pass 4.5:1.
- Fix      - A guest who cannot vote still sees the results of a poll whose results show always.
- Fix      - The kit shows the sign-in wording for a guest refusal from this engine or the 0.3.0 engine, never "Something went wrong".
- Security - A poll attached to a page, a content type or the whole site no longer shows on a draft or unpublished page.
- Security - When the host gives no visitor address, guest votes are refused instead of counted by a browser id, and the admin says so in one line.
- Security - Two votes sent at the same moment by one voter can no longer both count on a single-choice poll.
- Security - An IPv6 guest counts once per /64 network.

## [0.3.0]

Copy the kit again after you update.

- New      - The Polls list opens with how many polls are open and how many votes came in this week. Each status is a badge.
- New      - Results open with a bar chart above the totals and the answer table. A named poll lists voters 25 at a time.
- New      - Optional block, This page's poll, for post text. It is trusted site code and shows the poll attached to the page. If the post template also has the poll slot, the poll shows once, inside the article.
- Improve  - At phone width the polls list scrolls sideways and the results chart uses horizontal bars with short labels.
- Security - Shared kit 5: server-side plugin calls run inside EmDash with no web request.

## [0.2.4]

- The poll follows the site's light or dark choice (shared kit styles 3), so it stays readable when a visitor picks light mode on a device set to dark, and on themes that switch dark mode with a class.
- Guides: use cases, and how to use polls on blog posts and pages.

## [0.2.3]

- Open and close times use a date picker and a time list (UTC) instead of typed dates.
- The poll form has one field per answer, and the next one appears as you fill the last, instead of a small box that cut answers off. The same goes for the post editor's Poll panel.
- The poll form follows the order you decide in: question and answers, who votes, what voters see, where it shows, then when it runs. Content type, position and the open and close times appear only when they apply. A poll with votes says so in a notice at the top.
- Position on the page works: a slot marked above or below shows only polls set to that side. One slot without a position shows every poll, as before.
- The post editor's Poll panel names the shared poll a post already shows, instead of saying there is none. Its poll list reads "Choose a poll".
- Delete asks once. The Polls screen intro is one plain line.
- Kit: no blank band above the question, brand-colour result bars, a plain sign-in note on My votes, even spacing.
- Install guide: the shared kit files are copied only when the site's copy is older.

## [0.2.2]

- The page editor Poll panel can open a poll. New polls from the panel open so visitors can vote.
- The existing-poll list starts with "Choose a poll". The empty state is one short line.
- Polls list shows a Status column. Results open with vote totals as stats.

## [0.2.1]

- A closed poll stays on the page with its results. The owner can open it again.
- Copy keeps the attachment and opens the edit form so the heading can be renamed.
- The red "Pick an answer" line clears after a successful vote.
- Answer rows no longer pick up the theme's list indent.
- The kit includes `/account/votes` for My votes. Link it from the site header.
- Open and close time labels now show an example date. Block Kit has no date picker.

## [0.2.0]

- Members can open My votes, see the polls they voted in, and erase their own votes in two clicks.
- The kit reaches the plugin on a registry install (EmDash mounts it at a registry id, not at `/polls/`).
- Shared kit files match the starter. The poll canvas lives in `polls.css`, so other plugins are not framed.
- A hidden slot no longer leaves an empty box.
- New poll picks a content type by name, not a typed slug. The update asks for `schema:read` once.
- Open polls with results set to Always show one list before you vote, not the chart and the answers.

## [0.1.1]

- Kit poll sits on its own canvas, so dark mode question, scores and Vote stay readable on any host page.
- Missing poll empty state has a title and a help sentence.
- The whole option row is the tap target, with the kit focus ring.
- Lab demo seeds a slot poll that is not the same as the first poll.

## [0.1.0]

- Create, edit, open, close and delete polls from admin.
- Guests and signed-in members vote once. A poll can allow a change while it is open.
- Attach a poll to one page, a content type or the whole site.
- Anonymous or named results. The owner can erase one member's votes.
- Copy a poll into a new draft with no votes.
- Site kit poll and slot, with one wording file for visitor text.
