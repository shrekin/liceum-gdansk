#!/bin/bash
set -e

echo "🚀 Deploying to GitHub..."

git add -A
git diff --cached --quiet && echo "   ℹ️  Brak zmian do wysłania." && exit 0

git commit -m "${1:-"chore: aktualizacja"}"

git pull --rebase
git push

echo "✅ Done!"
