# Posts and pages

**Included in Free.** WB Polls has no paid version.

A poll only shows where your template has a poll slot. This page gives the exact steps for the standard EmDash blog template, created with `npm create emdash@latest -- --template blog`. Your developer does this once. First finish [Install WB Polls](install.md) so `PollSlot.astro` is in `src/components`.

## Posts

Open `src/pages/posts/[slug].astro`.

1. Add this import in the frontmatter, the code between the `---` lines at the top:

```astro
import PollSlot from "../../components/PollSlot.astro";
```

2. Add this line after the article content, inside the page markup:

```astro
<PollSlot collection="posts" id={post.data.id} />
```

## Pages

Open `src/pages/pages/[slug].astro`.

1. Add the same import in the frontmatter:

```astro
import PollSlot from "../../components/PollSlot.astro";
```

2. Add this line after the page content:

```astro
<PollSlot collection="pages" id={page.data.id} />
```

## Use `post.data.id`, not `post.id`

`post.data.id` is the entry id, and polls are saved against it. On this template `post.id` is the slug, which does not match, so no poll would show. The same goes for `page.data.id`.

## Above and below the content

To let each poll choose its side, add a slot on each side of the content and set `position`:

```astro
<PollSlot collection="posts" id={post.data.id} position="above" />
<!-- the content -->
<PollSlot collection="posts" id={post.data.id} position="below" />
```

With a single slot and no `position`, every poll shows in that one place. See [Where a poll shows](../features/where-polls-show.md#above-or-below-the-content).

## Check it works

1. Open a poll in admin and set **Where it shows**, or use the **Poll** panel in the editor.
2. Make sure the poll is **Open**.
3. Open the post or page in a private window.

The slot shows nothing when no poll applies, so it is safe on every post and page. If the poll does not appear, see [Troubleshooting](../troubleshooting/troubleshooting.md).
