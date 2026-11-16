## 0.5.2

- Improve  - The Poll panel finds an older poll by its question.
- Improve  - The Polls list shows Status and Actions first on a phone, and keeps your page and search after Open, Close or Delete.
- Fix      - Delete my votes is never blocked by the hourly vote limit.
- Fix      - Two answers with the same text are refused.
- Fix      - Open on a poll past its closing date says so; a past closing date is refused on save.

Copy the kit again after you update, from your site's root folder:

```bash
kit="$(mktemp -d)" &&
  git -c advice.detachedHead=false clone \
    --depth 1 --branch v0.5.2 \
    https://github.com/wbcomdesigns/emdash-polls \
    "$kit/emdash-polls" &&
  "$kit/emdash-polls/scripts/add-to-site.sh" .
```

## 0.5.1

- Fix      - The post editor's Poll panel works for Editors, and for Authors on their own entries.
- Security - An Author can attach only their own poll that no page uses now.
- Compat   - Needs EmDash 1.2.0 or later.

## 0.5.0

Every poll page, vote and admin screen now fits Cloudflare's limit of 10 requests per plugin call.

- New      - Each poll keeps a running total, so results show in one read on any size of poll.
- New      - Results has Recount votes, which counts a poll again from the stored votes.
- Improve  - Deleting a poll hides it at once; its votes, names included, are removed as you open admin screens.
- Improve  - Open and close times are read from the poll's dates on every view.
- Fix      - On Cloudflare a guest vote no longer shows "Something went wrong" after it was saved.
- Fix      - On Cloudflare the Polls screen, Results, My votes and the Poll panel no longer fail on a busy site.

A poll from an earlier version is counted the first time it is opened.

Earlier versions: see CHANGELOG.md in the repository.
