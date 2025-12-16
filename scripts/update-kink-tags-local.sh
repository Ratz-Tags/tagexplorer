#!/bin/bash
# Local script to update kink tags and optionally create a PR
# Usage: ./scripts/update-kink-tags-local.sh [--pr]

set -e

BRANCH="update/kink-tags-$(date +%Y%m%d-%H%M%S)"
CREATE_PR=false

# Check if --pr flag is provided
if [[ "$1" == "--pr" ]]; then
  CREATE_PR=true
fi

echo "🚀 Starting kink tags update..."
echo "📦 Installing dependencies..."
npm install || echo "⚠️  No dependencies needed"

echo "🔄 Running update script..."
node scripts/updateKinkTags.js

# Check if there are changes
if git diff --quiet && git diff --cached --quiet; then
  echo "✅ No changes to commit."
  exit 0
fi

echo "📝 Changes detected, committing..."

# Create a new branch
git checkout -b "$BRANCH" || git checkout "$BRANCH"

# Commit changes
git add -A
git commit -m "chore: update kink-tags.json (local run)" || echo "⚠️  Nothing to commit"

if [ "$CREATE_PR" = true ]; then
  echo "🔀 Pushing branch and creating PR..."
  git push -u origin "$BRANCH"
  
  # Create PR using GitHub CLI (requires gh CLI to be installed)
  if command -v gh &> /dev/null; then
    gh pr create \
      --title "chore: update kink-tags.json (local run)" \
      --body "Local update of kink-tags.json and artists.json

This PR was created from a local run of the update script.
Review the changes and merge when ready." \
      --base Holding \
      --head "$BRANCH" \
      --label "automated,data-update" || echo "⚠️  Failed to create PR (may already exist)"
  else
    echo "⚠️  GitHub CLI (gh) not installed. Push the branch manually and create a PR:"
    echo "   Branch: $BRANCH"
    echo "   Base: Holding"
  fi
else
  echo "✅ Changes committed to branch: $BRANCH"
  echo "💡 To create a PR, run: git push -u origin $BRANCH"
  echo "   Or run this script with --pr flag: ./scripts/update-kink-tags-local.sh --pr"
fi

