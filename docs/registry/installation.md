1. Install WB Polls from the registry. It asks for no extra permissions.
2. Copy the site kit into your site. On a lab, `./scripts/apply-kit.sh` does this. By hand, copy `site-kit/lib/`, `site-kit/styles/` and `site-kit/components/` into your `src/` folders of the same names.
3. Put `<PollSlot collection={entry.collection} id={entry.id} />` once in the template that wraps posts and pages, above or below the content. Or put `<Poll id="..." />` on one page.
4. Open Admin, then Polls. Create a poll, attach it, and open it.

Your site needs a sandbox runner in `astro.config.mjs`. Without one, EmDash skips sandboxed plugins at startup.

EmDash 1.2 or later.

Full steps: https://github.com/wbcomdesigns/emdash-polls/blob/main/site-kit/README.md
