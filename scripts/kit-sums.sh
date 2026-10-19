#!/usr/bin/env bash
# Rebuild site-kit/kit.sums: the SHA-256 of every file add-to-site.sh copies, at every released
# tag plus the working tree. add-to-site.sh backs up a site file only when its hash is not listed
# for its path. Run before every release, after the last kit change.
set -euo pipefail
cd "$(dirname "$0")/.."
sha() { if command -v sha256sum >/dev/null 2>&1; then sha256sum; else shasum -a 256; fi | cut -d' ' -f1; }
files=$(sed -n 's/^copy \([^ ]*\) .*/\1/p' scripts/add-to-site.sh)
{
	for tag in $(git tag --list 'v*' | sort -V); do
		for f in $files; do
			git cat-file -e "$tag:site-kit/$f" 2>/dev/null && echo "$(git show "$tag:site-kit/$f" | sha)  $f"
		done
	done
	for f in $files; do echo "$(sha < "site-kit/$f")  $f"; done
} | awk '!seen[$0]++' > site-kit/kit.sums
echo "site-kit/kit.sums: $(wc -l < site-kit/kit.sums | tr -d ' ') hashes"
