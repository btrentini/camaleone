#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Publish Camaleone to both extension marketplaces.

Usage:
  scripts/publish_marketplaces.sh [--version current|patch|minor|major|x.y.z] [options]

Options:
  --version <value>           Version to publish. Defaults to current package.json version.
                              Use patch/minor/major or an explicit semver to update package.json first.
  --skip-vscode               Do not publish to the Microsoft VS Code Marketplace.
  --skip-openvsx              Do not publish to Open VSX, which is used by Cursor's marketplace.
  --ensure-openvsx-namespace  Try to create the Open VSX namespace before publishing.
  --dry-run                   Run validation and packaging, but do not publish.
  -h, --help                  Show this help.

Environment:
  VSCE_PAT                    Microsoft Marketplace token for the package.json publisher.
  OVSX_PAT                    Open VSX token for the package.json publisher namespace.

Examples:
  VSCE_PAT=... OVSX_PAT=... scripts/publish_marketplaces.sh --version patch
  OVSX_PAT=... scripts/publish_marketplaces.sh --skip-vscode --version current
USAGE
}

log() {
  printf '[camaleone-publish] %s\n' "$*"
}

fail() {
  printf '[camaleone-publish] ERROR: %s\n' "$*" >&2
  exit 1
}

version_arg="current"
publish_vscode=1
publish_openvsx=1
ensure_openvsx_namespace=0
dry_run=0

while (($#)); do
  case "$1" in
    --version)
      [[ $# -ge 2 ]] || fail "--version requires a value"
      version_arg="$2"
      shift 2
      ;;
    --skip-vscode)
      publish_vscode=0
      shift
      ;;
    --skip-openvsx)
      publish_openvsx=0
      shift
      ;;
    --ensure-openvsx-namespace)
      ensure_openvsx_namespace=1
      shift
      ;;
    --dry-run)
      dry_run=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1"
      ;;
  esac
done

if [[ "$publish_vscode" -eq 0 && "$publish_openvsx" -eq 0 ]]; then
  fail "both marketplaces are disabled"
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
cd "$repo_root"

command -v node >/dev/null 2>&1 || fail "node is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"
command -v vsce >/dev/null 2>&1 || fail "vsce is required; install with: npm install -g @vscode/vsce"

if [[ "$publish_vscode" -eq 1 && "$dry_run" -eq 0 && -z "${VSCE_PAT:-}" ]]; then
  fail "VSCE_PAT is required to publish to the VS Code Marketplace"
fi

if [[ "$publish_openvsx" -eq 1 && "$dry_run" -eq 0 && -z "${OVSX_PAT:-}" ]]; then
  fail "OVSX_PAT is required to publish to Open VSX/Cursor"
fi

if [[ -n "$(git status --short)" ]]; then
  fail "working tree is not clean; commit or stash changes before publishing"
fi

publisher="$(node -p "require('./package.json').publisher")"
name="$(node -p "require('./package.json').name")"

if [[ "$version_arg" != "current" ]]; then
  log "Updating package version with npm version $version_arg"
  npm version "$version_arg" --no-git-tag-version
fi

version="$(node -p "require('./package.json').version")"
vsix_path="$repo_root/$name-$version.vsix"

log "Running tests"
npm test

log "Packaging $publisher.$name v$version"
vsce package --no-dependencies --out "$vsix_path"

if [[ "$dry_run" -eq 1 ]]; then
  log "Dry run complete. Built $vsix_path"
  exit 0
fi

if [[ "$publish_vscode" -eq 1 ]]; then
  log "Publishing to VS Code Marketplace as $publisher.$name"
  vsce publish --no-dependencies --packagePath "$vsix_path" --pat "$VSCE_PAT"
fi

if [[ "$publish_openvsx" -eq 1 ]]; then
  if [[ "$ensure_openvsx_namespace" -eq 1 ]]; then
    log "Ensuring Open VSX namespace $publisher exists"
    npx --yes ovsx create-namespace "$publisher" -p "$OVSX_PAT" || true
  fi

  log "Publishing to Open VSX/Cursor as $publisher.$name"
  npx --yes ovsx publish "$vsix_path" -p "$OVSX_PAT"
fi

log "Published $publisher.$name v$version"
