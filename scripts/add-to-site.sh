#!/usr/bin/env bash
# Adds the WB Polls site kit to an EmDash site. Safe to run again after a plugin update.
#   scripts/add-to-site.sh /path/to/your/site
# Replaces WB Polls' own kit files. Never replaces a newer shared Wbcom file another plugin copied,
# and keeps a dated backup of a wording file you changed before it copies the new one.
set -euo pipefail

PLUGIN="$(cd "$(dirname "$0")/.." && pwd)"
KIT="$PLUGIN/site-kit"
[[ -d "${1:-.}" ]] || { echo "No folder at ${1:-.}" >&2; exit 1; }
SITE="$(cd "${1:-.}" && pwd)"

if ! ls "$SITE"/astro.config.* >/dev/null 2>&1 || ! grep -q "emdash" "$SITE"/astro.config.*; then
	echo "$SITE is not an EmDash site (no astro.config that loads emdash)." >&2
	echo "Usage: $0 /path/to/your/site" >&2
	exit 1
fi

# The number on the first line of a shared file. A copy from before the numbers existed counts as 0.
shared_version() { local v; v="$(sed -n '1s/.*wbcom-shared: *\([0-9]*\).*/\1/p' "$1" 2>/dev/null)"; echo "${v:-0}"; }

notes=()
copy() { # copy <kit path> <site path>
	local from="$KIT/$1" to="$SITE/$2" name
	name="$(basename "$to")"
	mkdir -p "$(dirname "$to")"
	if [[ "$name" == wbcom-base.css || "$name" == wbcom-kit.ts ]] && [[ -f "$to" ]]; then
		if (( $(shared_version "$from") < $(shared_version "$to") )); then
			notes+=("Kept   $2 (wbcom-shared $(shared_version "$to") from another Wbcom plugin is newer than $(shared_version "$from"))")
			return
		fi
	fi
	# The My votes page is the site's own once it exists: the developer may point it at their layout.
	if [[ "$name" == votes.astro && -f "$to" ]]; then
		cmp -s "$from" "$to" || notes+=("Kept   $2 (yours; compare it with the kit copy in $KIT/$1 after an update)")
		return
	fi
	if [[ "$name" == polls-strings.ts && -f "$to" ]] && ! cmp -s "$from" "$to"; then
		local backup="$to.bak-$(date +%Y%m%d)"
		[[ -e "$backup" ]] && backup="$to.bak-$(date +%Y%m%d-%H%M%S)"
		cp "$to" "$backup"
		notes+=("Backup $2 differed from the kit, so your copy is in ${backup#"$SITE/"}. Move your wording into the new file.")
	fi
	cp "$from" "$to"
}

copy lib/wbcom-kit.ts src/lib/wbcom-kit.ts
copy lib/polls-strings.ts src/lib/polls-strings.ts
copy styles/wbcom-base.css src/styles/wbcom-base.css
copy styles/polls.css src/styles/polls.css
copy components/Poll.astro src/components/Poll.astro
copy components/PollSlot.astro src/components/PollSlot.astro
copy components/MyVotes.astro src/components/MyVotes.astro
copy pages/account/votes.astro src/pages/account/votes.astro

[[ -f "$SITE/src/layouts/Base.astro" ]] || notes+=("Check  src/pages/account/votes.astro imports ../../layouts/Base.astro, which this site does not have. Point it at your own layout.")

cat <<DONE
WB Polls kit copied into $SITE

  Components  src/components/Poll.astro, PollSlot.astro, MyVotes.astro
  Page        src/pages/account/votes.astro (My votes)
  Styles      src/styles/polls.css, src/styles/wbcom-base.css
  Wording     src/lib/polls-strings.ts (every phrase a visitor sees)
  Shared      src/lib/wbcom-kit.ts
  Content     WB Polls needs no content types, so there is nothing to seed.
DONE
for note in "${notes[@]+"${notes[@]}"}"; do echo "  $note"; done

cat <<'DONE'

Left for you:

  1. In src/pages/posts/[slug].astro, add this line inside the --- block at the top:

       import PollSlot from "../../components/PollSlot.astro";

     Then put one slot just before and one just after the post text,
     <PortableText value={post.data.content} />:

       <PollSlot collection="posts" id={post.data.id} position="above" />
       <PortableText value={post.data.content} />
       <PollSlot collection="posts" id={post.data.id} position="below" />

  2. In src/pages/pages/[slug].astro, the same import inside the --- block:

       import PollSlot from "../../components/PollSlot.astro";

     and the two slots around <PortableText value={page.data.content} />:

       <PollSlot collection="pages" id={page.data.id} position="above" />
       <PortableText value={page.data.content} />
       <PollSlot collection="pages" id={page.data.id} position="below" />

     Each poll shows in the slot that matches its Position setting. A slot with no poll shows nothing.

  3. In the admin, Menus: add a link "My votes" to /account/votes.

  4. Stop the dev server and start it again, then open a post and /account/votes.
     Create a poll in the admin (Polls, New poll), set it to show on the whole site, and open it.

DONE
version="$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$PLUGIN/package.json" | head -n 1)"
ref="main"
[[ -n "$version" ]] && ref="v$version"
echo "Guide: https://github.com/wbcomdesigns/emdash-polls/blob/$ref/docs/website/getting-started/install.md"
