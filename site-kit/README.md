# WB Polls site kit

The plugin is the engine. This folder is what a site developer copies into an EmDash site so visitors can see a poll and vote. The plugin alone does not draw a poll on the site.

Checked on EmDash 1.3.1 with the `blog` template on Node.

## Add it to your site

Install WB Polls from the registry first (Admin, Registry, search **WB Polls**). Your site needs a sandbox runner for that; the [install guide](../docs/website/getting-started/install.md#before-you-install) has the lines for Node and Cloudflare.

Then, from your site's root folder, get the kit at the tag of the version you installed and copy it in:

```bash
kit="$(mktemp -d)" &&
  git clone --depth 1 \
    --branch v0.3.1 \
    https://github.com/wbcomdesigns/emdash-polls \
    "$kit/emdash-polls" &&
  "$kit/emdash-polls/scripts/add-to-site.sh" .
```

(`mktemp -d` makes a fresh folder only you can write to, and `&&` runs the script only when the clone worked. Never clone into a fixed `/tmp/<name>`: on a shared machine someone else can create it first.)

The script refuses a folder that is not an EmDash site, copies the components, the My votes page, the styles and the wording file, copies the two shared Wbcom files only when your site has no copy or an older one (`wbcom-shared: N` on line 1), and saves `polls-strings.ts` as `polls-strings.ts.bak-YYYYMMDD` before it copies the new one, but only when you edited it (a hash not in `site-kit/lib/polls-strings.sums`). WB Polls needs no content types, so there is nothing to seed.

It then prints the lines to paste. On the blog template they are:

In `src/pages/posts/[slug].astro`, inside the `---` block at the top:

```astro
import PollSlot from "../../components/PollSlot.astro";
```

and around the post text:

```astro
<PollSlot collection="posts" id={post.data.id} position="above" />
<PortableText value={post.data.content} />
<PollSlot collection="posts" id={post.data.id} position="below" />
```

The same in `src/pages/pages/[slug].astro`, with `collection="pages"` and `id={page.data.id}` around `<PortableText value={page.data.content} />`.

Use the entry's own id (`post.data.id`), not `post.id`: on the blog template `post.id` is the slug, and polls attached from the post editor are stored against the entry id. Each poll shows in the slot that matches its **Position on the page** setting; a slot with no poll shows nothing.

Then add **My votes** to `/account/votes` in Admin, Menus, stop the dev server and start it again.

After every plugin update, run the command again with the new tag.

### A specific poll anywhere

```astro
---
import Poll from "../../components/Poll.astro";
---
<Poll id="p_..." />
```

Use `../components/` instead from a file one folder below `src/` (for example `src/layouts/`).

## Reword the kit

Every phrase a visitor can see lives in `src/lib/polls-strings.ts`. Change that file, then rebuild the site. Routes return codes; the kit turns a code into a phrase from this file.

## Before you add it to a live site

- **Guest voting.** Guests vote only where EmDash gets the visitor's address: on Cloudflare, or with `trustedProxyHeaders` set to a header your proxy writes itself and replaces (behind nginx, `X-Real-IP` with `trustedProxyHeaders: ["x-real-ip"]`, never an appended `X-Forwarded-For`). Elsewhere guests see a sign-in link and the Polls screen says so. See [Guest voting](../docs/website/getting-started/install.md#guest-voting).
- **The browser console.** A guest sees one expected 401 per poll from the member ballot check (`ballot`), and one on `/account/votes` (`mine`). That is how the kit learns the visitor is not signed in; the poll then shows the guest view.
- **Caching.** The kit markup is the same for every visitor. Vote state is decided in the browser from the API.
- **Sign-in.** The sign-in links go to `/_emdash/admin/login`. If your admin lives on another host, change `signInUrl()` in `src/lib/wbcom-kit.ts`.
- **Members.** Turn on member sign-up in EmDash if you want members-only polls.

## For the in-text block

Optional, trusted site code. Copy `site-kit/blocks/` to `src/polls-block/` and add `pollsBlock()` under `plugins` in `astro.config.mjs`. The install guide has the lines. The block is **This page's poll**. It shows the poll attached to that page. The registry plugin does not need this.

## What you should see

- A poll question, answers and a Vote button on an open poll
- Results when the poll's visibility rule allows them
- Nothing, not an empty box, when a slot has no matching poll
- My votes: polls the signed-in member voted in, and a two-click erase
- Admin, Polls: list, create, edit, results, copy, delete

## Working on this plugin

Not for site developers. The plugin's own lab is a fresh blog site on port 4332, built and reset by scripts in this repo:

```bash
./scripts/setup-lab.sh   # first time: creates ../emdash-lab-polls with --template blog
./scripts/reset-lab.sh   # test, build, copy the kit with add-to-site.sh, wipe data, restart
./scripts/prove-lab.sh   # route-level smoke
```

`site-kit/lab/` holds lab-only pages (`/polls-demo`, `/polls-mine`) that `apply-kit.sh` adds on top of the kit.
