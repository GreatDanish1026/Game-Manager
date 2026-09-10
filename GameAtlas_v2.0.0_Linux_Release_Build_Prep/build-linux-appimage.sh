#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

VERSION="2.0.0"
EXPECTED_NAME="GameAtlas"
EXPECTED_ID="com.greatdanish.gamemanager"

echo "GameAtlas v${VERSION} — Linux AppImage Release Build"
echo "Project root: ${PROJECT_ROOT}"
echo

required=(
  "package.json"
  "src-tauri/Cargo.toml"
  "src-tauri/tauri.conf.json"
)

for rel in "${required[@]}"; do
  if [[ ! -f "${PROJECT_ROOT}/${rel}" ]]; then
    echo "[FAIL] Missing required file: ${rel}" >&2
    exit 1
  fi
done

for cmd in node npm cargo; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[FAIL] Required command is unavailable: $cmd" >&2
    exit 1
  fi
done

echo "[PASS] Node, npm, and Cargo are available."

node - "$PROJECT_ROOT" "$VERSION" "$EXPECTED_NAME" "$EXPECTED_ID" <<'NODE'
const fs = require("fs");
const path = require("path");

const root = process.argv[2];
const version = process.argv[3];
const expectedName = process.argv[4];
const expectedId = process.argv[5];

const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);

const tauri = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8")
);

if (String(pkg.version) !== version) {
  throw new Error(`package.json version is ${pkg.version}; expected ${version}`);
}

if (String(tauri.version) !== version) {
  throw new Error(`tauri.conf.json version is ${tauri.version}; expected ${version}`);
}

if (String(tauri.productName) !== expectedName) {
  throw new Error(`productName is ${tauri.productName}; expected ${expectedName}`);
}

if (String(tauri.identifier) !== expectedId) {
  throw new Error(`identifier is ${tauri.identifier}; expected ${expectedId}`);
}

console.log("[PASS] Version and application identity validated.");
NODE

cargo_version="$(
  awk '
    /^\[package\]$/ { in_package=1; next }
    /^\[/ && in_package { exit }
    in_package && $1 == "version" {
      gsub(/"/, "", $3)
      print $3
      exit
    }
  ' "${PROJECT_ROOT}/src-tauri/Cargo.toml"
)"

if [[ "$cargo_version" != "$VERSION" ]]; then
  echo "[FAIL] Cargo.toml package version is '$cargo_version'; expected '$VERSION'." >&2
  exit 1
fi

echo "[PASS] Cargo.toml version = ${VERSION}"

if command -v git >/dev/null 2>&1 && git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  status="$(git -C "$PROJECT_ROOT" status --short)"
  if [[ -z "$status" ]]; then
    echo "[PASS] Git working tree is clean."
  else
    echo "[WARN] Git working tree contains uncommitted/untracked files."
    echo "       Review 'git status' before publishing."
  fi
fi

if [[ -n "${CONTAINER_ID:-}" ]]; then
  echo "[INFO] Distrobox/container detected: ${CONTAINER_ID}"
else
  echo "[WARN] CONTAINER_ID is not set."
  echo "       On Bazzite, this build is intended to run inside your gameatlas-dev Distrobox."
fi

echo
echo "Running frontend build..."
(
  cd "$PROJECT_ROOT"
  npm run build
)
echo "[PASS] Frontend build"

echo
echo "Running Rust compile check..."
(
  cd "$PROJECT_ROOT/src-tauri"
  cargo check
)
echo "[PASS] cargo check"

echo
echo "Building AppImage bundle..."
(
  cd "$PROJECT_ROOT"
  npm run tauri:build -- --bundles appimage
)
echo "[PASS] Tauri AppImage build completed"

bundle_dir="${PROJECT_ROOT}/src-tauri/target/release/bundle/appimage"

if [[ ! -d "$bundle_dir" ]]; then
  echo "[FAIL] AppImage bundle directory not found: $bundle_dir" >&2
  exit 1
fi

mapfile -t appimages < <(
  find "$bundle_dir" -maxdepth 1 -type f -name '*.AppImage' -printf '%T@ %p\n' \
  | sort -nr \
  | cut -d' ' -f2-
)

if [[ ${#appimages[@]} -eq 0 ]]; then
  echo "[FAIL] No AppImage was produced in: $bundle_dir" >&2
  exit 1
fi

built_appimage="${appimages[0]}"

release_dir="${PROJECT_ROOT}/release/v${VERSION}-linux"
mkdir -p "$release_dir"

release_appimage="${release_dir}/GameAtlas_${VERSION}_x86_64.AppImage"
cp -f "$built_appimage" "$release_appimage"
chmod +x "$release_appimage"

echo
echo "[PASS] Linux release artifact prepared:"
echo "       $release_appimage"

echo
echo "Generating SHA256..."
(
  cd "$release_dir"
  sha256sum "$(basename "$release_appimage")" > SHA256SUMS.txt
)

echo "[PASS] SHA256SUMS.txt created."

echo
echo "Structural AppImage extraction test..."
tmp_extract="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_extract"
}
trap cleanup EXIT

(
  cd "$tmp_extract"
  "$release_appimage" --appimage-extract >/dev/null
)

if [[ ! -d "${tmp_extract}/squashfs-root" ]]; then
  echo "[FAIL] AppImage extraction test did not produce squashfs-root." >&2
  exit 1
fi

echo "[PASS] AppImage extraction test"

echo
echo "Linux release directory:"
echo "  $release_dir"
echo
echo "Files:"
ls -lh "$release_dir"

echo
echo "[PASS] GameAtlas ${VERSION} Linux AppImage release build is ready for manual testing."
echo
echo "Test launch from Bazzite:"
echo "  \"${release_appimage}\""
echo
echo "If WebKit/NVIDIA compositing is needed in your environment:"
echo "  WEBKIT_DISABLE_COMPOSITING_MODE=1 \"${release_appimage}\""
echo
echo "No GitHub release was created."
