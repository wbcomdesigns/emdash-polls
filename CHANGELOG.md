# Changelog

Versions match `package.json`, the git tag and the registry release. Newest first.

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
