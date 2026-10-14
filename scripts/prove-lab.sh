#!/usr/bin/env bash
# Route-level smoke on the running lab. Add one check per route as you build it.
set -euo pipefail
source "$(dirname "$0")/lab-env.sh"
API="$BASE/_emdash/api/plugins/$SLUG"

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "PASS: $1"; }
json() { curl -sf -H "X-EmDash-Request: 1" -H "Origin: $BASE" "$@"; }
status() { curl -s -o /dev/null -w "%{http_code}" -H "X-EmDash-Request: 1" -H "Origin: $BASE" "$@"; }

json "$API/health" | grep -q '"ok":true' || fail "health"
ok "health"

for leftover in "This poll is not available." "Sign in to vote." "This poll is closed." "company website" "Change vote" "My votes" "Delete my votes" "You have not voted in any polls yet."; do
	if grep -F -q -- "$leftover" "$PLUGIN/site-kit/components/Poll.astro" "$PLUGIN/site-kit/components/PollSlot.astro" "$PLUGIN/site-kit/components/MyVotes.astro"; then
		fail "visitor phrase still in kit component: $leftover"
	fi
done
ok "kit wording lives in the wording file"

# Member and admin routes must refuse guests. List every such route here.
for route in editor_poll ballot mine ${GUEST_REFUSED_ROUTES:-}; do
	[[ "$(status "$API/$route")" == "401" ]] || fail "guest refused on $route"
done
[[ "$(status -X POST "$API/vote")" == "401" ]] || fail "guest refused on vote"
ok "guests refused on member and admin routes"

JAR="$(mktemp)"; trap 'rm -f "$JAR"' EXIT
curl -sf -c "$JAR" -o /dev/null "$BASE/_emdash/api/setup/dev-bypass?redirect=/"
[[ "$(status -b "$JAR" -X POST -H 'Content-Type: application/json' -d '{"type":"page_load","page":"/polls"}' "$API/admin")" == "200" ]] || fail "admin page loads"
ok "admin page loads"

json "$API/get?id=missing" | grep -q '"code":"NOT_FOUND"' || fail "get missing"
ok "get missing is NOT_FOUND"
latest="$(json "$API/get?latest=1")"
echo "$latest" | grep -q '"code":"NOT_FOUND"' || echo "$latest" | grep -q '"status":"open"' || fail "get latest"
ok "get latest"

curl -sf "$BASE/polls-demo" | grep -q "data-wbp" || fail "polls demo page"
ok "polls demo page"
curl -sf "$BASE/polls-mine" | grep -q "data-wbp-mine" || fail "polls mine page"
ok "polls mine page"
curl -sf "$BASE/account/votes" | grep -q "data-wbp-mine" || fail "account votes page"
ok "account votes page"
json -b "$JAR" "$API/mine" | grep -q '"ok":true' || fail "mine get"
ok "mine get as member"

slot="$(json "$API/slot?collection=docs&id=none")"
echo "$slot" | grep -q '"ok":true' || fail "slot"
ok "slot"

BASE="$BASE" JAR="$JAR" DEMO_IDS="$LAB/src/pages/poll-demo-ids.json" node "$PLUGIN/scripts/seed-lab-demo.mjs" || fail "seed demo polls"
ok "demo polls seeded"
json "$API/get?latest=1" | grep -q "Which " || fail "seeded latest"
ok "seeded latest is readable"

echo "All checks passed for $SLUG"
