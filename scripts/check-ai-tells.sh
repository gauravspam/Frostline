#!/usr/bin/env sh
set -euo pipefail

# Check staged changes for AI-tell patterns
# Self-excludes config files that contain detection patterns

# Get staged diff, skipping files that contain the detection patterns themselves
STAGED_DIFF=$(git diff --cached -U0 | awk '
  /^diff --git/ { skip = 0 }
  /pre-commit-config\.yaml/ { skip = 1 }
  /check-ai-tells\.sh/ { skip = 1 }
  /install-security-tools\.sh/ { skip = 1 }
  !skip
')

# Block em dashes (Unicode U+2014)
if echo "$STAGED_DIFF" | grep -nP "\x{2014}" >/dev/null 2>&1; then
  echo "Error: em dash detected in staged changes."
  echo "$STAGED_DIFF" | grep -nP "\x{2014}" | head -5
  exit 1
fi

# Block narration patterns
PATTERN="Changed from|Updated from|Refactored|Cleanup|Minor tweak|adjusted from|Fix:|Note:|TODO: revisit"
if echo "$STAGED_DIFF" | grep -nE "$PATTERN" >/dev/null 2>&1; then
  echo "Error: narration-style comment detected in staged changes."
  echo "$STAGED_DIFF" | grep -nE "$PATTERN" | head -5
  exit 1
fi

echo "No AI-tell patterns found."
exit 0