#!/bin/bash
# fix-line-endings.sh
# Strips Windows CR (\r) from all text source files in the project.
# Run this on Linux/WSL before building if files were edited on Windows.

set -e

EXTENSIONS=("*.js" "*.jsx" "*.ts" "*.tsx" "*.json" "*.html" "*.css"
            "*.md" "*.yml" "*.yaml" "*.sh" "*.env" "*.txt" "*.mjs" "*.cjs")

TARGET="${1:-.}"

echo "Fixing line endings in: $TARGET"

for ext in "${EXTENSIONS[@]}"; do
  while IFS= read -r -d '' file; do
    if file "$file" | grep -qE 'CRLF|Windows'; then
      sed -i 's/\r$//' "$file"
      echo "  Fixed: $file"
    fi
  done < <(find "$TARGET" -type f -name "$ext" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/.next/*" \
    -print0)
done

echo "Line endings fixed."
