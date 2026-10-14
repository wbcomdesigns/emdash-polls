# Polls - Core paths (the 60-70%)

Seeded from SCOPE.md, the 0.1.0 walk, and the registry description. Confirm on the next human QA cycle.

Last confirmed: 2026-10-14 by the 0.1.1 fix session (needs a human tick)

| # | Flow (owner's words) | Role | Surface | Why it is core | Journey | Free/Pro |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Put a poll on a page and see the question | Guest | kit `/polls-demo` or any `<Poll />` | The product the owner bought | G-4 G-6 | one plugin |
| 2 | A visitor votes once | Guest | kit form → `vote_guest` | Zero-config job | G-6 | one plugin |
| 3 | Results show when the owner said they should | Guest | kit + `get` | Visibility is the trust rule | G-3 G-4 | one plugin |
| 4 | Create and open a poll | Admin | admin form + list | Nothing public without this | A-1 A-2 | one plugin |
| 5 | Close a poll so voting stops | Admin | list Actions | Owner control | A-4 | one plugin |
| 6 | Attach a poll to a page, a type, or the site | Admin + guest | form + `PollSlot` | How it appears on a real site | A-9 G-9 | one plugin |
| 7 | Members-only poll asks a guest to sign in | Guest / subscriber | kit | Who can vote | G-1 M-1 | one plugin |
| 8 | Named poll shows names only to the owner | Subscriber / admin | kit notice + results | Privacy | M-9 A-10 | one plugin |
| 9 | Copy a poll to try a new wording | Admin | list Copy | Owner workflow | #15 | one plugin |
| 10 | Read results and erase one member | Admin | Results | Moderation | A-6 A-10 | one plugin |

## Edge (walk after core)

| Flow | Role | Surface | Why it is edge |
| --- | --- | --- | --- |
| Change vote while open | Subscriber | kit | Optional setting |
| Scheduled open / close times | Guest | kit | Empty by default |
| My votes / erase own votes | Subscriber | kit `/account/votes` | 0.2.0 #6, page in 0.2.1 #35 |
| In-text Poll block | Editor | trusted companion | #16 waiting |

## Zero-config check (C-2)

Create a poll with two answers, open it, drop `<Poll latest />` on a page, vote as a guest. Results show. No settings beyond the create form.
