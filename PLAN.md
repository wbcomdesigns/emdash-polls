# Plan: Polls

The plan for this plugin, kept in the repository so it travels with the code. `SCOPE.md` says what the plugin is. This file says in what order it gets built and what waits.

## Decisions made with the owner

| Question | Decision |
| --- | --- |
| Who can take part | The site owner chooses: signed-in members only, or anyone. Default is anyone. |
| How a poll gets onto a page | Both. The owner attaches a poll in admin (to one page, to every entry of a collection, or site-wide), and a developer can also place a specific poll by id. |
| Who sees how people voted | The owner chooses per poll: anonymous (totals only) or named. Voters are told before they vote. Guests are always anonymous. |

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
11. **Lab, prove script and demo page**. Proven by: tests
12. **Owner docs, registry branding and release gate**. Proven by: the whole checklist

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
