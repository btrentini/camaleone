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
  No token environment variables are required. The script runs each marketplace
  login command, lets the CLI prompt for the access token, publishes, then logs
  out and removes the temporary credential store.

Examples:
  scripts/publish_marketplaces.sh --version patch
  scripts/publish_marketplaces.sh --skip-vscode --version current
USAGE
}

log() {
  printf '[camaleone-publish] %s\n' "$*"
}

fail() {
  printf '[camaleone-publish] ERROR: %s\n' "$*" >&2
  exit 1
}

vsce_temp_home=""
ovsx_temp_home=""

cleanup_credentials() {
  local status=$?

  unset VSCE_PAT
  unset OVSX_PAT

  if [[ -n "$vsce_temp_home" && -d "$vsce_temp_home" ]]; then
    if [[ -n "${publisher:-}" ]]; then
      HOME="$vsce_temp_home" VSCE_STORE=file vsce logout "$publisher" >/dev/null 2>&1 || true
    fi
    rm -rf "$vsce_temp_home"
  fi

  if [[ -n "$ovsx_temp_home" && -d "$ovsx_temp_home" ]]; then
    if [[ -n "${publisher:-}" ]]; then
      HOME="$ovsx_temp_home" OVSX_STORE=file npx --yes ovsx logout "$publisher" >/dev/null 2>&1 || true
    fi
    rm -rf "$ovsx_temp_home"
  fi

  return "$status"
}

make_temp_home() {
  local name="$1"
  local temp_home

  temp_home="$(mktemp -d "${TMPDIR:-/tmp}/camaleone-${name}.XXXXXX")"
  chmod 700 "$temp_home"
  printf '%s\n' "$temp_home"
}

run_vsce() {
  HOME="$vsce_temp_home" VSCE_STORE=file vsce "$@"
}

run_ovsx() {
  HOME="$ovsx_temp_home" OVSX_STORE=file npx --yes ovsx "$@"
}

logout_vsce() {
  if [[ -n "$vsce_temp_home" && -d "$vsce_temp_home" ]]; then
    run_vsce logout "$publisher" >/dev/null 2>&1 || true
    rm -rf "$vsce_temp_home"
    vsce_temp_home=""
  fi
}

logout_ovsx() {
  if [[ -n "$ovsx_temp_home" && -d "$ovsx_temp_home" ]]; then
    run_ovsx logout "$publisher" >/dev/null 2>&1 || true
    rm -rf "$ovsx_temp_home"
    ovsx_temp_home=""
  fi
}

trap cleanup_credentials EXIT

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
  vsce_temp_home="$(make_temp_home vsce)"
  log "VS Code step 1/3: run 'vsce login $publisher'"
  log "Enter the VS Code Marketplace access token at the prompt. It is stored only under a temporary HOME and removed before exit."
  run_vsce login "$publisher"

  log "VS Code step 2/3: run 'vsce publish --packagePath $vsix_path'"
  run_vsce publish --no-dependencies --packagePath "$vsix_path"

  log "VS Code step 3/3: run 'vsce logout $publisher' and remove temporary credentials"
  logout_vsce
fi

if [[ "$publish_openvsx" -eq 1 ]]; then
  ovsx_temp_home="$(make_temp_home ovsx)"
  log "Open VSX step 1/3: run 'ovsx login $publisher'"
  log "Enter the Open VSX/Cursor access token at the prompt. It is stored only under a temporary HOME and removed before exit."
  run_ovsx login "$publisher"

  if [[ "$ensure_openvsx_namespace" -eq 1 ]]; then
    log "Open VSX optional step: run 'ovsx create-namespace $publisher'"
    run_ovsx create-namespace "$publisher" || true
  fi

  log "Open VSX step 2/3: run 'ovsx publish $vsix_path'"
  run_ovsx publish "$vsix_path"

  log "Open VSX step 3/3: run 'ovsx logout $publisher' and remove temporary credentials"
  logout_ovsx
fi

log "Published $publisher.$name v$version"
