1. Install WB Polls from the registry. Confirm `schema:read` so the poll form can list your content types by name. An update from 0.1.x asks for this once.
2. Copy the site kit into your site. On a lab, `./scripts/apply-kit.sh` does this. By hand, copy `site-kit/lib/`, `site-kit/styles/` and `site-kit/components/` into your `src/` folders of the same names. After an update, copy the kit again so visitor pages can reach the plugin on a registry install.
3. Put `<PollSlot collection="posts" id={post.data.id} />` in the post template (use `post.data.id`, not `post.id`), and with `collection="pages" id={page.data.id}` in the page template. To let each poll choose above or below, place two slots with `position="above"` and `position="below"`. Or put `<Poll id="..." />` on one page.
4. Open Admin, then Polls. Create a poll, attach it, and open it.

Optional: copy `site-kit/blocks/` to `src/polls-block/` and add `pollsBlock()` under `plugins` to insert a Poll block inside a post. You pick the poll from a list of the first 100. The page stores that poll. The registry plugin works without that.

Your site needs a sandbox runner in `astro.config.mjs`. Without one, EmDash skips sandboxed plugins at startup.

EmDash 1.2 or later.

Full steps: https://github.com/wbcomdesigns/emdash-polls/blob/main/site-kit/README.md

Guides: https://github.com/wbcomdesigns/emdash-polls/tree/main/docs/website
