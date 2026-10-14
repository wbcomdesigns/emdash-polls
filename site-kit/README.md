# WB Polls site kit

The plugin is the engine. This folder is what an EmDash site owner copies so visitors can see a poll and vote.

Install WB Polls first (or the local package). Then apply this kit. The plugin alone does not draw a poll on the site.

## Apply on a site

On the lab, prefer `./scripts/apply-kit.sh` (or `./scripts/setup-lab.sh` the first time). That script never replaces a newer shared `wbcom-kit.ts` or `wbcom-base.css` another plugin already copied. Manual copy from the site root (`src/` is the Astro app):

`wbcom-kit.ts` finds the plugin on a registry install (EmDash gives it an id, not the name `polls`) and on a local install. After you update the plugin, copy the kit again.

```bash
K=path/to/emdash-polls/site-kit

mkdir -p src/lib src/styles src/components
cp $K/lib/polls-strings.ts src/lib/polls-strings.ts
cp $K/styles/polls.css src/styles/polls.css
cp $K/components/Poll.astro src/components/Poll.astro
cp $K/components/PollSlot.astro src/components/PollSlot.astro
cp $K/components/MyVotes.astro src/components/MyVotes.astro

# The two shared files are used by every Wbcom plugin. Line 1 carries a number
# (wbcom-shared: N). Copy only when the site has no copy yet or an older one,
# so another plugin's newer copy is never replaced.
newer() { [ ! -f "$2" ] || [ "$(head -1 "$1" | grep -o '[0-9]\+')" -gt "$(head -1 "$2" | grep -o '[0-9]\+' || echo 0)" ]; }
newer $K/lib/wbcom-kit.ts src/lib/wbcom-kit.ts && cp $K/lib/wbcom-kit.ts src/lib/wbcom-kit.ts
newer $K/styles/wbcom-base.css src/styles/wbcom-base.css && cp $K/styles/wbcom-base.css src/styles/wbcom-base.css
```

Then add one slot to the layout that wraps posts and pages:

```astro
---
import PollSlot from "../components/PollSlot.astro";
---
<PollSlot collection={entry.collection} id={entry.id} />
```

Or place a specific poll:

```astro
---
import Poll from "../components/Poll.astro";
---
<Poll id="p_..." />
```

Copy `site-kit/pages/account/votes.astro` to `src/pages/account/votes.astro` (change the layout import if your site uses a different layout). Link **My votes** in the site header to `/account/votes`.

On that page:

```astro
---
import MyVotes from "../components/MyVotes.astro";
---
<MyVotes />
```

`astro.config.mjs` must load the sandbox runner and the plugin.

## Reword the kit

Every phrase a visitor can see lives in `src/lib/polls-strings.ts`. Change that file, then rebuild the site. Routes return codes; the kit turns a code into a phrase from this file.

## Before you add it to a live site

- **EmDash version.** Built and tested on EmDash 1.2. Update the site first.
- **Caching.** The kit markup is the same for every visitor. Vote state is decided in the browser from the API.
- **Sign-in.** The sign-in links go to `/_emdash/admin/login`. If your admin lives on another host, change `signInUrl()` in `src/lib/wbcom-kit.ts`.
- **Members.** Turn on member sign-up in EmDash if you want members-only polls.
- **Try it on a preview first.** Deploy a preview version, walk `docs/qa/QA_CHECKLIST.md` there, then go live.

## For the in-text block

A registry install cannot put a poll inside article text. The slot and `<Poll id />` are the product. A trusted (native) companion can add a Poll block to the editor; that is optional, and the registry install stays complete without it. See GitHub issue #16.

## What you should see

- A poll question, answers and a Vote button on an open poll
- Results when the poll's visibility rule allows them
- Nothing, not an empty box, when a slot has no matching poll
- My votes: polls the signed-in member voted in, and a two-click erase
- Admin → Polls: list, create, edit, results, copy, delete

## Lab prove

```bash
./scripts/reset-lab.sh
./scripts/prove-lab.sh
```

Then open http://127.0.0.1:4332/polls-demo and http://127.0.0.1:4332/polls-mine
