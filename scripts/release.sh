#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.5.0"
  exit 1
fi

VERSION="$1"

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in X.Y.Z format (e.g. 0.5.0)"
  exit 1
fi

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "Error: Must be on main branch (current: $BRANCH)"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Commit or stash changes first."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PUBSPEC="$PROJECT_ROOT/app/pubspec.yaml"

BUILD_NUMBER=$(git rev-list --count HEAD)
FULL_VERSION="${VERSION}+${BUILD_NUMBER}"

echo "Releasing v$VERSION (build $BUILD_NUMBER)"

sed -i -E "s/^version: .*/version: ${FULL_VERSION}/" "$PUBSPEC"

cd "$PROJECT_ROOT/app"
if command -v flutter &>/dev/null; then
  flutter pub get
elif [ -f "$HOME/sdk/flutter/bin/flutter" ]; then
  "$HOME/sdk/flutter/bin/flutter" pub get
else
  echo "Warning: flutter not found, skipping pub get"
fi

cd "$PROJECT_ROOT"
git add "$PUBSPEC" app/pubspec.lock
git commit -m "app: bump version to $VERSION"
git push

echo "Version bumped to $VERSION. CI will auto-release."
