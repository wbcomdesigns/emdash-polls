## 0.2.2

- Fix: the page editor Poll panel can open a poll, and new polls open so visitors can vote.
- Fix: the existing-poll list starts with "Choose a poll".

## 0.2.1

- Fix: a closed poll stays visible with results, and can be opened again.
- Fix: copy keeps the attachment and opens rename.
- Fix: the vote error clears after a successful vote. Answer rows stay flush.
- New: copy `pages/account/votes.astro` and link My votes in the header.

## 0.2.0

- New: My votes lists the polls you voted in. Two clicks erase them.
- Fix: the kit reaches a registry install. Copy the kit again after you update.
- Fix: one list of answers before you vote when results are always visible.
- Fix: pick a content type by name (`schema:read` on update). A hidden slot no longer leaves an empty box.

## 0.1.1

- Polls stay readable in dark mode on any site theme.
- A missing poll explains what to do next.
- Tapping anywhere on an answer selects it.

## 0.1.0

- New: create, edit, open, close and delete polls from admin.
- New: guests and signed-in members can vote once, with an optional change while the poll is open.
- New: attach a poll to one page, a content type or the whole site.
- New: anonymous or named results. The owner can erase one member's votes.
- New: copy a poll into a new draft with no votes.
- New: site kit poll and slot components, with one wording file for visitor text.
