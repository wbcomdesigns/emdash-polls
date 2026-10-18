## 0.3.1

Guests vote only where the host gives EmDash the visitor's address (Cloudflare, or `trustedProxyHeaders` set the safe way, see FAQ). Elsewhere they sign in.

- Security: two votes sent at once by one voter count once. An IPv6 guest counts once per /64.
- New: a Set up visitor pages card and `scripts/add-to-site.sh` copy the kit in one command.
- Fix: the PollSlot snippet works on the blog post template. Dark mode buttons pass 4.5:1.

Copy the kit again after you update, from your site's root folder:

```bash
kit="$(mktemp -d)" &&
  git clone --depth 1 \
    --branch v0.3.1 \
    https://github.com/wbcomdesigns/emdash-polls \
    "$kit/emdash-polls" &&
  "$kit/emdash-polls/scripts/add-to-site.sh" .
```

## 0.3.0

- New: poll stats on the list, a results bar chart, and an optional This page's poll block for post text (trusted install).
- Security: server-side calls run inside EmDash with no web request. Copy the kit again after updating.

## 0.2.4

- Fix: polls stay readable when a visitor picks the site's light mode on a device set to dark. New guides for use cases and posts and pages.

## 0.2.3

- New: one field per answer on the poll form, and the next appears as you type. Fields show only when they apply.
- New: pick open and close times from a date picker and a time list (UTC).
- Fix: Position on the page now places the poll above or below the content.
- Fix: the post editor's Poll panel names the shared poll visitors see.
- Fix: delete asks once. Cleaner poll card, brand-colour bars, plain sign-in note.

## 0.2.2

- Fix: the page editor Poll panel can open a poll, and new polls open so visitors can vote.
- Fix: the existing-poll list starts with "Choose a poll".

Older versions: https://github.com/wbcomdesigns/emdash-polls/blob/main/CHANGELOG.md
