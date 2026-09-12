#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
VERSION="${2:-2.1.0}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

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

[[ ${#images[@]} -gt 0 ]] || {
  echo "[FAIL] No AppImage found in $BUNDLE_DIR" >&2
  exit 1
}

APPIMAGE="${images[0]}"
SIG="${APPIMAGE}.sig"

[[ -f "$SIG" ]] || {
  echo "[FAIL] No updater signature found next to AppImage:" >&2
  echo "  $SIG" >&2
  echo >&2
  echo "Ensure src-tauri/tauri.conf.json contains:" >&2
  echo '  "bundle": { "createUpdaterArtifacts": true }' >&2
  echo "and build with TAURI_SIGNING_PRIVATE_KEY configured." >&2
  exit 1
}

mkdir -p "$RELEASE_DIR"
OUT_IMAGE="$RELEASE_DIR/GameAtlas_${VERSION}_x86_64.AppImage"
OUT_SIG="${OUT_IMAGE}.sig"

cp -f "$APPIMAGE" "$OUT_IMAGE"
cp -f "$SIG" "$OUT_SIG"
chmod +x "$OUT_IMAGE"

(
  cd "$RELEASE_DIR"
  sha256sum "$(basename "$OUT_IMAGE")" > SHA256SUMS.txt
)

echo "[PASS] Linux updater artifacts prepared:"
echo "  $OUT_IMAGE"
echo "  $OUT_SIG"
echo "  $RELEASE_DIR/SHA256SUMS.txt"
echo
echo "To create a Linux-only updater manifest:"
echo "  node scripts/merge-updater-manifest.mjs \\"
echo "    --version $VERSION \\"
echo "    --linux-asset \"$OUT_IMAGE\" \\"
echo "    --linux-sig \"$OUT_SIG\" \\"
echo "    --out \"$RELEASE_DIR/latest.json\""
