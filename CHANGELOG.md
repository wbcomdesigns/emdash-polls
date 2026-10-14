# Changelog

Versions match `package.json`, the git tag and the registry release. Newest first.

## [Unreleased]

- Polls opens with how many polls are open and how many votes came in this week. Each status shows as a badge.
- Results opens with a bar chart, then the totals and the answer table. A named poll lists members 25 at a time.
- The poll form stays one Save. Block Kit cannot put an accordion inside a form, so the question, who can vote, where it shows, and when results appear stay in that one form.
- Optional Poll block for post text. It is trusted site code. You pick the poll by its question. The registry plugin is unchanged.

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
