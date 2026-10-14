# Install WB Polls

**Included in Free.** WB Polls has no paid version.

Installing takes two steps: the plugin in admin, then the site kit in your site's code. The second step needs someone who can edit the site's files.

## Before you start

- Your site runs EmDash 1.2 or later.
- Your site loads plugins from the registry. In `astro.config.mjs`, EmDash needs a sandbox runner. Sites made with `npm create emdash@latest` from version 1.2 already have one.

## Step 1: install the plugin

1. In admin, open **Plugins**, then **Registry**.
2. Search for **WB Polls** and choose **Install**.
3. EmDash lists what the plugin asks for. WB Polls asks for one thing: to read your content types, so you can pick one by name when you place a poll. Confirm the install.

A **Polls** item and a **New poll** item now appear in the admin menu.

## Step 2: copy the site kit

The kit is in the `site-kit/` folder of the [WB Polls repository](https://github.com/wbcomdesigns/emdash-polls), at the tag of the version you installed. From your site's root folder:

```bash
K=path/to/emdash-polls/site-kit

mkdir -p src/lib src/styles src/components src/pages/account
cp $K/lib/polls-strings.ts src/lib/polls-strings.ts
cp $K/styles/polls.css src/styles/polls.css
cp $K/components/Poll.astro src/components/Poll.astro
cp $K/components/PollSlot.astro src/components/PollSlot.astro
cp $K/components/MyVotes.astro src/components/MyVotes.astro
cp $K/pages/account/votes.astro src/pages/account/votes.astro
```

Two more files, `wbcom-kit.ts` and `wbcom-base.css`, are shared by every Wbcom plugin. If another Wbcom plugin already copied them, keep the newer copy. The first line of each file carries a number (`wbcom-shared: N`); copy only when your site has no copy yet or a lower number. The [kit guide](https://github.com/wbcomdesigns/emdash-polls/blob/main/site-kit/README.md) has a short script that does this check for you.

## Step 3: add the poll to your post and page layout

Open the template that shows a single post (in the blog starter, `src/pages/posts/[slug].astro`) and add the slot where the poll should appear, usually after the content:

```astro
---
import PollSlot from "../../components/PollSlot.astro";
---
<PollSlot collection={entry.collection} id={entry.id} />
```

Do the same in the page template (`src/pages/pages/[slug].astro`) if you want polls on pages. The slot shows nothing at all when no poll applies, so it is safe to add everywhere.

To let each poll choose above or below the content, place two slots instead. See [Where a poll shows](../features/where-polls-show.md#above-or-below-the-content).

## Step 4: link My votes (optional)

Add a **My votes** link to your site menu (**Menus** in admin) pointing at `/account/votes`. Members use it to see and delete their votes.

## Check it worked

1. Create a poll and open it ([Your first poll](first-poll.md)).
2. Visit a post. The poll shows where you placed the slot.

If nothing shows, see [Troubleshooting](../troubleshooting/troubleshooting.md).

## After you update the plugin

Copy the kit again from the new version's tag. The kit and the plugin are released together, and an older kit may not reach a newer plugin.
