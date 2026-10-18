#!/usr/bin/env bash
# Shell checks for scripts/add-to-site.sh (the plugin tests run in a sandbox with no file system).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/add-to-site.sh"
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
fail() { echo "FAIL: $1" >&2; exit 1; }
site() { local d; d="$(mktemp -d)"; echo 'import emdash from "emdash/astro";' > "$d/astro.config.mjs"; mkdir -p "$d/src/lib" "$d/src/styles" "$d/src/pages/posts"; echo "$d"; }

[[ "$(tail -n 1 "$ROOT/site-kit/lib/polls-strings.sums")" == "$(sha "$ROOT/site-kit/lib/polls-strings.ts")" ]] || fail "the current wording file is not the last line of polls-strings.sums"

d="$(mktemp -d)"; "$SCRIPT" "$d" >/dev/null 2>&1 && fail "accepted a folder that is not an EmDash site"

d="$(site)"
git -C "$ROOT" show v0.3.0:site-kit/lib/polls-strings.ts > "$d/src/lib/polls-strings.ts"
printf '/* wbcom-shared: 3 */\n' > "$d/src/styles/wbcom-base.css"
printf '/* wbcom-shared: 99 */\n' > "$d/src/lib/wbcom-kit.ts"
echo '<PollSlot collection="posts" />' > "$d/src/pages/posts/[slug].astro"
out="$("$SCRIPT" "$d")"
grep -q "Backup" <<<"$out" && fail "backed up an untouched older wording file"
ls "$d/src/lib" | grep -q ".bak-" && fail "left a backup of an untouched wording file"
grep -q "Upgraded src/styles/wbcom-base.css from wbcom-shared 3 to" <<<"$out" || fail "did not announce the shared CSS upgrade"
grep -q "Kept   src/lib/wbcom-kit.ts (wbcom-shared 99" <<<"$out" || fail "did not keep the newer shared kit file"
[[ "$(head -n 1 "$d/src/lib/wbcom-kit.ts")" == "/* wbcom-shared: 99 */" ]] || fail "replaced a newer shared file"
grep -q "src/pages/posts/\[slug\].astro: the PollSlot lines are already in place" <<<"$out" || fail "repeated paste steps for a wired template"

echo "export const polls = { vote: 'Stem' };" > "$d/src/lib/polls-strings.ts"
out="$("$SCRIPT" "$d")"
grep -q "had your own wording" <<<"$out" || fail "did not back up an edited wording file"
grep -q "Stem" "$d"/src/lib/polls-strings.ts.bak-* || fail "backup does not hold the owner's wording"

echo "add-to-site.sh: all checks passed"
