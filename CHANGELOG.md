# Changelog

Versions match `package.json`, the git tag and the registry release. Newest first.

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
