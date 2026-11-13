## 0.5.1

- Fix      - The post editor's Poll panel works for Editors, and for Authors on their own entries.
- Security - An Author can attach only their own poll that no page uses now.
- Compat   - Needs EmDash 1.2.0 or later.

Copy the kit again after you update, from your site's root folder:

```bash
kit="$(mktemp -d)" &&
  git clone --depth 1 \
    --branch v0.5.1 \
    https://github.com/wbcomdesigns/emdash-polls \
    "$kit/emdash-polls" &&
  "$kit/emdash-polls/scripts/add-to-site.sh" .
```

## 0.5.0

Every poll page, vote and admin screen now fits Cloudflare's limit of 10 requests per plugin call.

- New      - Each poll keeps a running total, so results show in one read on any size of poll.
- New      - Results has Recount votes, which counts a poll again from the stored votes.
- Improve  - Deleting a poll hides it at once; its votes, names included, are removed as you open admin screens.
- Improve  - Open and close times are read from the poll's dates on every view.
- Fix      - On Cloudflare a guest vote no longer shows "Something went wrong" after it was saved.
- Fix      - On Cloudflare the Polls screen, Results, My votes and the Poll panel no longer fail on a busy site.

A poll from an earlier version is counted the first time it is opened.

## 0.4.0

- New: Read your content permission, so a poll on a draft page stays hidden until you publish it.
- New: a Set up visitor pages card and `scripts/add-to-site.sh` copy the kit in one command.
- Security: guests vote only where the host gives the visitor's address. Two votes sent at once by one voter count once.

Earlier versions: see CHANGELOG.md in the repository.
