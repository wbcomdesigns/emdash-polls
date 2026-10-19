#!/usr/bin/env bash
# Copy the site kit into the lab the same way a site developer does (scripts/add-to-site.sh),
# then add the lab-only pages and the optional in-text block.
set -euo pipefail
source "$(dirname "$0")/lab-env.sh"
[[ -d "$LAB/src" ]] || { echo "Lab not found at $LAB. Run scripts/setup-lab.sh first." >&2; exit 1; }

"$PLUGIN/scripts/add-to-site.sh" "$LAB" >/dev/null
# Lab-only pages that mount the components for a browser walk.
if [[ -d "$PLUGIN/site-kit/lab" ]]; then
	mkdir -p "$LAB/src/pages"
	cp -R "$PLUGIN/site-kit/lab/." "$LAB/src/pages/"
fi
if [[ -d "$PLUGIN/site-kit/blocks" ]]; then
	mkdir -p "$LAB/src/polls-block"
	cp -R "$PLUGIN/site-kit/blocks/." "$LAB/src/polls-block/"
fi
echo "Copied site-kit into $LAB"
