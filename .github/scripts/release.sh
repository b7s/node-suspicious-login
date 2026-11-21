#!/usr/bin/env bash
set -euo pipefail

git fetch --tags origin
if [[ "$(git ls-remote origin refs/heads/main | cut -f1)" != "$GITHUB_SHA" ]]; then
  echo "A newer push superseded this release run."
  exit 0
fi

tag="$(git tag --merged HEAD --list 'v[0-9]*' --sort=-version:refname | sed -n '1p')"
if [[ -z "$tag" ]]; then
  tag="v$(node -p 'require("./package.json").version')"
  if [[ "$tag" != v0.1.0 ]]; then
    echo "The initial release must be v0.1.0." >&2
    exit 1
  fi
  target=(--target "$GITHUB_SHA")
elif [[ "$(git rev-list -n 1 "$tag")" == "$GITHUB_SHA" ]]; then
  if gh release view "$tag" >/dev/null 2>&1; then
    echo "$tag has already been published."
    exit 0
  fi
  target=(--verify-tag)
else
  exec npm exec --yes --package=semantic-release@26.0.1 -- semantic-release
fi

# The bootstrap release and recovery both pack the exact version from the tag.
npm version "${tag#v}" --no-git-tag-version --allow-same-version --ignore-scripts
mkdir -p dist
asset="$(npm pack --ignore-scripts --pack-destination dist --silent)"
gh release create "$tag" "dist/$asset" "${target[@]}" --title "$tag" --generate-notes
