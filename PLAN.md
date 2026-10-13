# Plan: Polls

**Status: LOCKED on 2026-10-13.** Scope and decisions were agreed with the owner. An agent does not add options or features. If a task cannot be done as written, stop, say why on its issue, and wait for the owner.

The plan for this plugin, kept in the repository so it travels with the code. `SCOPE.md` says what the plugin is. This file says in what order it gets built and what waits.

## Decisions made with the owner

| Question | Decision |
| --- | --- |
| Who can take part | The site owner chooses: signed-in members only, or anyone. Default is anyone. |
| How a poll gets onto a page | Both. The owner attaches a poll in admin (to one page, to every entry of a collection, or site-wide), and a developer can also place a specific poll by id. |
| Who sees how people voted | The owner chooses per poll: anonymous (totals only) or named. Voters are told before they vote. Guests are always anonymous. |
| Wording and language | One wording file per plugin kit. Every visitor-facing phrase lives there, so an owner can translate or reword the plugin by editing one file. |
| Attaching a poll | From a Poll panel on the post or page editing screen (to be proven first), and from the poll form for a whole content type or the whole site. No block inside article text: this kind of plugin cannot add one. |
| Editing after votes | Wording only. Answers cannot be added, removed or reordered, and the choice type is locked. |
| Several polls for one place | Most specific wins (page, then content type, then site), then newest. The list warns when a poll is hidden. |
| Open time | Optional. A poll can open by itself. |
| Position | Per poll: above or below the content. |
| Numbers | Per poll: percent and count, or percent only. |
| Copy a poll | In 0.1.0. |
| Past polls page, download of votes | Not in 0.1.0. |
| Long lists and setup | Next, Previous and find in admin. Developer guide plus one command. |

## 0.1.0: first release

Work the cards in this order. Each is a GitHub issue under milestone `0.1.0` with its build list, UX bar, function bar and QA cases. Later cards assume earlier ones.

1. **Schema and manifest**. Proven by: tests
2. **Admin: create, edit, open, close, delete**. Proven by: A-1, A-2, A-3, A-4, A-5
3. **Public read and results visibility**. Proven by: G-1, G-2, G-3
4. **Voting**. Proven by: M-1, M-2, M-3, M-4, M-5
5. **Poll component**. Proven by: G-4, M-6, P-1, P-2, P-3, P-4, P-5
6. **My votes and erase**. Proven by: M-7, M-8
7. **Admin results view**. Proven by: A-6
8. **Guest participation**. Proven by: G-6, G-7, G-8, A-8
9. **Attach a poll and the poll slot**. Proven by: G-9, A-9
10. **Anonymous and named polls**. Proven by: M-9, A-10, A-11
11. **Wording file**. Proven by: G-91
12. **Lab, prove script and demo page**. Proven by: tests
13. **Owner docs, registry branding and release gate**. Proven by: the whole checklist

0.1.0 is done when every card is closed with a verification comment, `docs/qa/QA_CHECKLIST.md` has an honest last-walk line, and the gate in `CONTRIBUTING.md` passes. The owner publishes.

## 0.2.0: parked on purpose

Agreed as worth doing, not now. Do not start these during 0.1.0.

- Scheduling a poll to open later
- Export of results

## Not planned

See "Out of scope" in `SCOPE.md`. If a card seems to need one of those, stop and ask the owner.

## Before it goes on a live site

- Prove the kit on a preview deploy of one existing site, never on production first
- Check the site's EmDash version, its content security policy, and its page cache against what the kit does
- Findings from the first plugin are in `wbcomdesigns/emdash-listora` issue #23

## Order after the owner review (2026-10-13)

Issue numbers are out of order because tasks were added late. Work them like this: #1 schema, #2 admin, #14 Poll panel (prove first), #3 public read, #4 voting, #5 poll component, #11 attach and slots, #12 anonymous and named, #10 guests, #6 my votes, #7 results view, #15 copy a poll, #13 wording file, #8 lab and demo, #9 docs, branding and release gate.

One agent works this repo, in order, on a branch named `0.1.0`, opens a pull request into `main` and stops. It never merges, tags or publishes. Copy the proven patterns from `emdash-listora` (compare-and-set rate limit, guarded writes, version token on admin decisions), do not reinvent them.

## Who uses this today (owner, 2026-10-13)

Everyone installing an EmDash plugin today is a developer. So a step that needs a developer (copying the kit, a trusted install to get an in-text block) is acceptable now. The screens the site owner and visitors use after setup still have to be plain and complete: no internal ids, no half-built features. We keep polishing setup as EmDash grows.

After #14, do #16 (in-text Poll block, prove first).
