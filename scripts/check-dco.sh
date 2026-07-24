#!/usr/bin/env bash
# Verifies every non-bot commit in the pull request carries a Signed-off-by trailer
# (DCO, see CONTRIBUTING.md). Reads the commit list from the GitHub API's PR-commits
# endpoint rather than git log: that list is exactly the PR's own commits, and never
# includes the synthetic merge commit GitHub creates when merging the PR (which has
# no contributor to sign off), so merge-queue / PR-merge commits need no special-casing.
set -euo pipefail

: "${REPO:?REPO (owner/repo) must be set}"
: "${PR_NUMBER:?PR_NUMBER must be set}"

commits=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}/commits" --paginate --jq '
  .[]
  # Bots such as dependabot[bot] have no human contributor to sign off, so they are exempt.
  | select((((.author // {}).login) // "") | endswith("[bot]") | not)
  | [.sha, (.commit.message | @base64)]
  | @tsv
')

if [ -z "$commits" ]; then
  echo "check-dco: no non-bot commits to check"
  exit 0
fi

fail=0
while IFS=$'\t' read -r sha message_b64; do
  message=$(printf '%s' "$message_b64" | base64 -d)
  if ! printf '%s\n' "$message" | grep -qE '^Signed-off-by: .+ <.+>$'; then
    subject=$(printf '%s\n' "$message" | head -n1)
    echo "NG: ${sha:0:12} is missing a Signed-off-by trailer: ${subject}" >&2
    fail=1
  fi
done <<< "$commits"

if [ "$fail" -eq 1 ]; then
  echo "Add 'Signed-off-by: Name <email>' to every commit (git commit -s). See CONTRIBUTING.md." >&2
  exit 1
fi

echo "check-dco: OK"
