# Install WB Polls

**Included in Free.** WB Polls has no paid version.

New permission: Read your content, so a poll attached to a draft stays hidden until you publish that page. You approve it once when you update.

Installing takes two parts: the plugin in the admin, then the site kit in your site's code. The second part needs someone who can edit the site's files.

## Before you install

**1. Your site needs a sandbox runner.** Registry plugins run in a sandbox. Until the site has one, Admin, Plugins shows "No plugins configured" and there is no Registry in the menu.

- **Node:** in your site, run `npm install @emdash-cms/sandbox-workerd workerd`, then add `sandboxRunner: "@emdash-cms/sandbox-workerd/sandbox",` inside `emdash({ ... })` in `astro.config.mjs`.
- **Cloudflare:** add `import { sandbox } from "@emdash-cms/cloudflare";` and `sandboxRunner: sandbox(),`. It needs the Workers Paid plan, the `worker_loaders` binding named `LOADER` (uncomment it in your Wrangler config) and an R2 bucket as `storage: r2(...)`, or the install stops with "Storage error while installing plugin". Then run `npm run deploy`.

Stop the dev server and start it again. **Registry** now shows in the admin menu.

**2. The plugin is the engine. Visitor pages come from its site kit.** A registry plugin cannot add pages to your site. Until you copy the kit, its addresses (for example `/account/votes`) show your site's 404 page. That is expected. The kit copy below takes one command.

Checked on EmDash 1.3.1 with the `blog` template, on Node and on Cloudflare Workers (registry install).

## Install

1. Admin, Registry, search **WB Polls**, Install, then accept the permissions. WB Polls asks to read your content: the list of content types, so you can pick one by name, and whether a page is published, so a poll on a draft stays hidden until you publish it. A **Polls** item and a **New poll** item appear in the admin menu.
2. From your site's root folder, get the kit for the version you just installed and copy it in:

   ```bash
   kit="$(mktemp -d)" &&
     git clone --depth 1 \
       --branch v0.5.0 \
       https://github.com/wbcomdesigns/emdash-polls \
       "$kit/emdash-polls" &&
     "$kit/emdash-polls/scripts/add-to-site.sh" .
   ```

   (`mktemp -d` makes a fresh folder only you can write to, and `&&` runs the script only when the clone worked. Never clone into a fixed `/tmp/<name>`: on a shared machine someone else can create it first.)

   The script copies the kit, never replaces a newer shared file another Wbcom plugin already copied, keeps a backup of any kit file you changed yourself, and prints the exact lines to paste into your templates, with the file names. WB Polls needs no content types, so there is nothing to seed.
3. Paste the lines it printed (below). Restart the dev server.
4. Add the menu link it printed in Admin, Menus: **My votes** to `/account/votes`.
5. Open **Polls** in the admin and follow its first screen. Create a poll, choose where it shows, and open it ([Your first poll](first-poll.md)).

After every plugin update, run step 2 again with the new tag.

## The template lines

On the EmDash blog template, the post template is `src/pages/posts/[slug].astro`. Add the import inside the `---` block at the top:

```astro
import PollSlot from "../../components/PollSlot.astro";
```

Then put one slot just before and one just after the post text, `<PortableText value={post.data.content} />`:

```astro
<PollSlot collection="posts" id={post.data.id} position="above" />
<PortableText value={post.data.content} />
<PollSlot collection="posts" id={post.data.id} position="below" />
```

Do the same in the page template, `src/pages/pages/[slug].astro`, with `collection="pages"` and `id={page.data.id}` around `<PortableText value={page.data.content} />`.

- Use `post.data.id`, the entry's own id. On the blog template `post.id` is the address (slug), and a poll attached from the post editor would not find it.
- Each poll shows in the slot that matches its **Position on the page** setting. A slot with no poll shows nothing at all, so it is safe on every post. One slot with no `position` shows any poll where it sits. See [Where a poll shows](../features/where-polls-show.md#above-or-below-the-content).
- The import path is `../../components/` because the template sits two folders below `src/`. From a file one folder deep (for example `src/layouts/`), use `../components/`.

## What the script copies

| File | What it is |
| --- | --- |
| `src/components/Poll.astro`, `PollSlot.astro`, `MyVotes.astro` | The poll, the slot that finds the page's poll, and the member's vote list |
| `src/pages/account/votes.astro` | The My votes page. It uses `src/layouts/Base.astro`; the script tells you if your site has no such layout. Copied only the first time, so your changes to it stay |
| `src/styles/polls.css` | The poll's own styles |
| `src/lib/polls-strings.ts` | Every phrase a visitor sees. Reword or translate it here |
| `src/lib/wbcom-kit.ts`, `src/styles/wbcom-base.css` | Shared by every Wbcom plugin. The first line carries `wbcom-shared: N`, and the script copies them only when your site has no copy or a lower number |

Run it again after an update: it replaces WB Polls' components, styles and wording file, and keeps your My votes page. Before it replaces a file you changed yourself (its contents match no released version, listed in `site-kit/kit.sums`), it saves yours as `<file>.bak-YYYYMMDD` next to it and lists the backups. Move your changes into the new file. Untouched files from any older release are replaced without a word. When it replaces an older shared file another Wbcom plugin copied, it prints the old and new `wbcom-shared` numbers. A template that already has the `<PollSlot` lines is reported as already in place, and a template your site does not have is named, with no paste steps.

## Guest voting

A poll set to **Anyone** takes guest votes only where EmDash knows the visitor's address. One guest is one address (an IPv6 guest is one /64 network), stored as a salted hash, never the address itself.

EmDash gives a plugin the visitor's address only on Cloudflare, or when the site sets `trustedProxyHeaders` inside `emdash({ ... })` in `astro.config.mjs` (for example `trustedProxyHeaders: ["x-real-ip"],`). Without an address, guests are asked to sign in before they can vote, so one person cannot vote many times.

Set `trustedProxyHeaders` only to a header that **your proxy writes itself and replaces** on every request. EmDash reads the first address in that header. Many proxies **add** to `X-Forwarded-For` instead of replacing it (nginx `$proxy_add_x_forwarded_for`, most load balancers), so the first address is whatever the visitor typed, and a guest could vote again and again. Behind nginx, set `proxy_set_header X-Real-IP $remote_addr;` and use `trustedProxyHeaders: ["x-real-ip"]`. Behind another proxy, use the header it overwrites with the connecting address. If you are not sure, leave it unset: members can still take part.

Without an address, guests see the poll (with its results when the poll shows them to everyone) and a **Sign in to vote** link, members vote as usual, and the Polls screen says in one line that guests cannot vote.

## The browser console

A guest sees one `401` per poll in the browser console, from the member ballot check (`.../ballot?id=...`), and one on `/account/votes` (`.../mine`). That is expected. Your pages are cached the same for every visitor, so the poll asks the member route whether this visitor is signed in, and a guest's answer is 401. The poll then shows the guest view (or the sign-in link), and nothing is broken.

## For the in-text block

This is optional. The plugin from the registry does not add a block inside post text. To put one poll in the middle of a post, copy the block and switch it on as trusted site code, in the same terminal as the kit copy (so `$kit` still points at the checkout):

```bash
mkdir -p src/polls-block
cp -R "$kit/emdash-polls/site-kit/blocks/." src/polls-block/
```

In `astro.config.mjs`:

```js
import { pollsBlock } from "./src/polls-block/descriptor.mjs";

emdash({
	plugins: [pollsBlock()],
	// sandboxed: [polls] stays as it is
});
```

Restart the site. In a post or page, type `/poll` and choose **This page's poll**. It shows the poll you attached to that page from the post editor's Poll panel. If your post template also has the poll slot, the poll moves into the article and shows once. Leave this out and the registry plugin works the same.

## Check it worked

1. Create a poll, set **Where it shows** to **Whole site**, and open it.
2. Visit a post. The poll shows above or below the text, as its Position says.
3. Sign in as a member and open `/account/votes`. Your vote is listed.

If nothing shows, see [Troubleshooting](../troubleshooting/troubleshooting.md).
