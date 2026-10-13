#!/usr/bin/env bash
# QA personas for Polls. EmDash lab, not WordPress.
#   bash bin/qa-fixtures.sh          # create / verify
#   bash bin/qa-fixtures.sh --list   # show state
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=../scripts/lab-env.sh
source "$PLUGIN_DIR/scripts/lab-env.sh"
CONFIG="$PLUGIN_DIR/docs/qa/qa-config.json"
[[ -f "$CONFIG" ]] || { echo "missing $CONFIG"; exit 1; }
[[ -f "$LAB_DB" ]] || { echo "Lab database not found at $LAB_DB. Run scripts/reset-lab.sh first."; exit 1; }

list_users() {
	printf '%-28s %-12s %s\n' EMAIL ROLE ID
	sqlite3 -separator $'\t' "$LAB_DB" "select email, role, id from users order by email;" | while IFS=$'\t' read -r email role id; do
		label="other"
		case "$role" in
			10) label="subscriber" ;;
			20) label="contributor" ;;
			30) label="author" ;;
			40) label="editor" ;;
			50) label="admin" ;;
		esac
		printf '%-28s %-12s %s\n' "$email" "$label" "$id"
	done
	echo
	echo "Guest: private window, no cookie."
	echo "Subscriber walk: $PLUGIN_DIR/scripts/lab-role.sh subscriber"
	echo "Admin walk:      $PLUGIN_DIR/scripts/lab-role.sh admin"
	echo "Sign in:         $BASE/_emdash/api/setup/dev-bypass?redirect=/"
}

if [[ "${1:-}" == "--list" ]]; then
	list_users
	exit 0
fi

if ! sqlite3 "$LAB_DB" "select 1 from users where email = 'dev@emdash.local';" | grep -q 1; then
	echo "missing lab bypass account dev@emdash.local"
	exit 1
fi

if sqlite3 "$LAB_DB" "select 1 from users where email = 'qa-rft-member@emdash.local';" | grep -q 1; then
	echo "= qa-rft-member@emdash.local already exists"
else
	sqlite3 "$LAB_DB" "insert into users (id, email, name, role, email_verified) values ('QA-RFT-MEMBER', 'qa-rft-member@emdash.local', 'QA-RFT Member', 10, 1);"
	echo "+ qa-rft-member@emdash.local created (subscriber row, no bypass login)"
fi

list_users
echo "fixtures ready. Prefix test data QA-RFT."
