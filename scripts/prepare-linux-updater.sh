#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
VERSION="${2:-}"

PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
TAURI_CONFIG="$PROJECT_ROOT/src-tauri/tauri.conf.json"

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

pass() {
  echo "[PASS] $*"
}

[[ -f "$TAURI_CONFIG" ]] || fail "Tauri config not found: $TAURI_CONFIG"

if [[ -z "$VERSION" ]]; then
  VERSION="$(
    node -e '
      const fs = require("fs");
      const cfg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (!cfg.version) process.exit(2);
      process.stdout.write(String(cfg.version).replace(/^v/, ""));
    ' "$TAURI_CONFIG"
  )" || fail "Unable to read version from $TAURI_CONFIG"
fi

VERSION="${VERSION#v}"

[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || fail "Invalid version: $VERSION"

BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage"
RELEASE_DIR="$PROJECT_ROOT/release/v${VERSION}-linux-updater"

[[ -d "$BUNDLE_DIR" ]] || {
  echo "[FAIL] AppImage bundle directory not found: $BUNDLE_DIR" >&2
  echo "Build a signed AppImage first:" >&2
  echo "  npm run tauri:build -- --bundles appimage" >&2
  exit 1
}

mapfile -t images < <(
  find "$BUNDLE_DIR" -maxdepth 1 -type f -name '*.AppImage' -printf '%T@ %p\n' |
  sort -nr |
  cut -d' ' -f2-
)

[[ ${#images[@]} -gt 0 ]] || fail "No AppImage found in $BUNDLE_DIR"

APPIMAGE="${images[0]}"
SIG="${APPIMAGE}.sig"

[[ -s "$SIG" ]] || {
  echo "[FAIL] No non-empty updater signature found next to AppImage:" >&2
  echo "  $SIG" >&2
  echo >&2
  echo "Ensure createUpdaterArtifacts is enabled and build with" >&2
  echo "TAURI_SIGNING_PRIVATE_KEY configured." >&2
  exit 1
}

mkdir -p "$RELEASE_DIR"

OUT_IMAGE="$RELEASE_DIR/GameAtlas_${VERSION}_x86_64.AppImage"
OUT_SIG="${OUT_IMAGE}.sig"
OUT_MANIFEST="$RELEASE_DIR/latest.json"

cp -f "$APPIMAGE" "$OUT_IMAGE"
cp -f "$SIG" "$OUT_SIG"
chmod +x "$OUT_IMAGE"

(
  cd "$RELEASE_DIR"
  sha256sum "$(basename "$OUT_IMAGE")" > SHA256SUMS.txt
)

node "$PROJECT_ROOT/scripts/merge-updater-manifest.mjs"   --version "$VERSION"   --linux-asset "$OUT_IMAGE"   --linux-sig "$OUT_SIG"   --out "$OUT_MANIFEST"   --require-linux

node "$PROJECT_ROOT/scripts/validate-updater-manifest.mjs"   --manifest "$OUT_MANIFEST"   --version "$VERSION"   --require-linux

pass "Linux updater artifacts prepared and validated:"
echo "  $OUT_IMAGE"
echo "  $OUT_SIG"
echo "  $RELEASE_DIR/SHA256SUMS.txt"
echo "  $OUT_MANIFEST"
echo
echo "For the final multi-platform release, copy the AppImage and .sig into"
echo "the Windows release staging directory and let release.ps1 generate"
echo "the combined latest.json."
