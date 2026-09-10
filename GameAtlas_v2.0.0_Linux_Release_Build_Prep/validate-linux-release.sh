#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

VERSION="2.0.0"
release_dir="${PROJECT_ROOT}/release/v${VERSION}-linux"
appimage="${release_dir}/GameAtlas_${VERSION}_x86_64.AppImage"
checksums="${release_dir}/SHA256SUMS.txt"

echo "GameAtlas v${VERSION} — Linux Release Validation"
echo

if [[ ! -f "$appimage" ]]; then
  echo "[FAIL] Missing AppImage: $appimage" >&2
  exit 1
fi

if [[ ! -s "$appimage" ]]; then
  echo "[FAIL] AppImage is empty." >&2
  exit 1
fi

if [[ ! -x "$appimage" ]]; then
  echo "[FAIL] AppImage is not executable." >&2
  exit 1
fi

echo "[PASS] AppImage exists, is non-empty, and is executable."

if [[ ! -f "$checksums" ]]; then
  echo "[FAIL] Missing SHA256SUMS.txt" >&2
  exit 1
fi

(
  cd "$release_dir"
  sha256sum -c SHA256SUMS.txt
)

echo "[PASS] SHA256 verification"

if command -v file >/dev/null 2>&1; then
  file "$appimage"
fi

tmp_extract="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_extract"
}
trap cleanup EXIT

(
  cd "$tmp_extract"
  "$appimage" --appimage-extract >/dev/null
)

if [[ ! -d "${tmp_extract}/squashfs-root" ]]; then
  echo "[FAIL] AppImage extraction failed." >&2
  exit 1
fi

if [[ ! -f "${tmp_extract}/squashfs-root/AppRun" ]]; then
  echo "[FAIL] AppRun was not found inside the AppImage." >&2
  exit 1
fi

echo "[PASS] AppImage structure contains AppRun."

desktop_count="$(
  find "${tmp_extract}/squashfs-root" -maxdepth 2 -type f -name '*.desktop' | wc -l
)"

if [[ "$desktop_count" -lt 1 ]]; then
  echo "[WARN] No .desktop file was found in the extracted AppImage."
else
  echo "[PASS] Desktop entry found."
fi

echo
echo "[PASS] Linux release artifact validation completed."
echo
echo "Manual runtime test still required before publication:"
echo "  $appimage"
