#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION=""
SIGNING_KEY=""
RELEASE_NOTES=""
RELEASE_DIR=""
REPOSITORY="GreatDanish1026/Game-Manager"
SKIP_BUILD=0

fail() {
  echo "[FAIL] $*" >&2
  exit 1
}

pass() {
  echo "[PASS] $*"
}

step() {
  echo
  echo "==> $*"
}

usage() {
  cat <<'EOF'
GameAtlas signed Linux release builder

Usage:
  ./scripts/release.sh [options]

Options:
  --key PATH         Tauri updater private-key path (prompted when omitted)
  --version VERSION  Release version (defaults to tauri.conf.json)
  --notes FILE       Release notes file
  --root PATH        Project root
  --release-dir PATH Output directory (defaults to release/v<version>)
  --repo OWNER/REPO  GitHub repository used in updater URLs
  --skip-build       Reuse an existing signed AppImage and regenerate metadata
  -h, --help         Show this help
EOF
}

while (($#)); do
  case "$1" in
    --key)
      (($# >= 2)) || fail "--key requires a value"
      SIGNING_KEY="$2"
      shift 2
      ;;
    --version)
      (($# >= 2)) || fail "--version requires a value"
      VERSION="$2"
      shift 2
      ;;
    --notes)
      (($# >= 2)) || fail "--notes requires a value"
      RELEASE_NOTES="$2"
      shift 2
      ;;
    --root)
      (($# >= 2)) || fail "--root requires a value"
      PROJECT_ROOT="$(cd "$2" && pwd)"
      shift 2
      ;;
    --release-dir)
      (($# >= 2)) || fail "--release-dir requires a value"
      RELEASE_DIR="$2"
      shift 2
      ;;
    --repo)
      (($# >= 2)) || fail "--repo requires a value"
      REPOSITORY="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

for command_name in node npm cargo find sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Required command is not installed: $command_name"
done

TAURI_CONFIG="$PROJECT_ROOT/src-tauri/tauri.conf.json"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
CARGO_TOML="$PROJECT_ROOT/src-tauri/Cargo.toml"

for required_file in "$TAURI_CONFIG" "$PACKAGE_JSON" "$CARGO_TOML"; do
  [[ -f "$required_file" ]] || fail "Required project file not found: $required_file"
done

CONFIG_VERSION="$(node -e '
  const fs = require("fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version;
  if (!value) process.exit(2);
  process.stdout.write(String(value).replace(/^v/, ""));
' "$TAURI_CONFIG")" || fail "Could not read tauri.conf.json version"

PACKAGE_VERSION="$(node -e '
  const fs = require("fs");
  const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version;
  if (!value) process.exit(2);
  process.stdout.write(String(value).replace(/^v/, ""));
' "$PACKAGE_JSON")" || fail "Could not read package.json version"

VERSION="${VERSION:-$CONFIG_VERSION}"
VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] || fail "Invalid semantic version: $VERSION"
[[ "$CONFIG_VERSION" == "$VERSION" ]] || fail "tauri.conf.json version does not match $VERSION"
[[ "$PACKAGE_VERSION" == "$VERSION" ]] || fail "package.json version does not match $VERSION"

CARGO_VERSION="$(sed -nE 's/^version[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' "$CARGO_TOML" | head -n 1)"
[[ "$CARGO_VERSION" == "$VERSION" ]] || fail "Cargo.toml version does not match $VERSION"

if [[ -n "$RELEASE_NOTES" ]]; then
  [[ -s "$RELEASE_NOTES" ]] || fail "Release notes file is missing or empty: $RELEASE_NOTES"
  RELEASE_NOTES="$(cd "$(dirname "$RELEASE_NOTES")" && pwd)/$(basename "$RELEASE_NOTES")"
fi

if [[ -z "$RELEASE_DIR" ]]; then
  RELEASE_DIR="$PROJECT_ROOT/release/v$VERSION"
elif [[ "$RELEASE_DIR" != /* ]]; then
  RELEASE_DIR="$PWD/$RELEASE_DIR"
fi

step "GameAtlas v$VERSION Linux release"

if ((SKIP_BUILD == 0)); then
  SIGNING_KEY="${SIGNING_KEY:-${TAURI_SIGNING_PRIVATE_KEY:-${TAURI_SIGNING_PRIVATE_KEY_PATH:-}}}"
  if [[ -z "$SIGNING_KEY" ]]; then
    read -r -p "Path to your Tauri updater private key: " SIGNING_KEY </dev/tty
  fi
  [[ -n "$SIGNING_KEY" ]] || fail "A Tauri updater private key is required"

  if [[ -f "$SIGNING_KEY" ]]; then
    SIGNING_KEY="$(cd "$(dirname "$SIGNING_KEY")" && pwd)/$(basename "$SIGNING_KEY")"
  fi

  read -r -s -p "Signing-key password (press Enter only if the key has no password): " SIGNING_PASSWORD </dev/tty
  echo >&2

  cleanup_secret() {
    unset SIGNING_PASSWORD TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PATH TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  }
  trap cleanup_secret EXIT INT TERM

  export TAURI_SIGNING_PRIVATE_KEY="$SIGNING_KEY"
  unset TAURI_SIGNING_PRIVATE_KEY_PATH || true
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$SIGNING_PASSWORD"
  # Fedora 44 libraries use RELR sections unsupported by linuxdeploy's bundled
  # strip utility. Skipping this optional size optimization is portable and
  # leaves the signed application code unchanged.
  export NO_STRIP="${NO_STRIP:-1}"

  step "Install locked dependencies"
  (cd "$PROJECT_ROOT" && npm ci)

  step "Build and sign AppImage"
  (
    cd "$PROJECT_ROOT"
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
      npm run tauri:build -- --bundles appimage
  )

  cleanup_secret
  trap - EXIT INT TERM
fi

BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle/appimage"
[[ -d "$BUNDLE_DIR" ]] || fail "AppImage bundle directory not found: $BUNDLE_DIR"

mapfile -t APPIMAGES < <(
  find "$BUNDLE_DIR" -maxdepth 1 -type f -name '*.AppImage' -printf '%T@ %p\n' |
    sort -nr |
    cut -d' ' -f2-
)
[[ ${#APPIMAGES[@]} -gt 0 ]] || fail "No AppImage found in $BUNDLE_DIR"

BUILT_IMAGE="${APPIMAGES[0]}"
BUILT_SIGNATURE="$BUILT_IMAGE.sig"
[[ -s "$BUILT_IMAGE" ]] || fail "Built AppImage is missing or empty: $BUILT_IMAGE"
[[ -s "$BUILT_SIGNATURE" ]] || fail "Updater signature is missing or empty: $BUILT_SIGNATURE"

mkdir -p "$RELEASE_DIR"
IMAGE_NAME="GameAtlas_${VERSION}_x86_64.AppImage"
RELEASE_IMAGE="$RELEASE_DIR/$IMAGE_NAME"
RELEASE_SIGNATURE="$RELEASE_IMAGE.sig"
MANIFEST_PATH="$RELEASE_DIR/latest.json"

cp -f "$BUILT_IMAGE" "$RELEASE_IMAGE"
cp -f "$BUILT_SIGNATURE" "$RELEASE_SIGNATURE"
chmod +x "$RELEASE_IMAGE"

export GAMEATLAS_MANIFEST_PATH="$MANIFEST_PATH"
export GAMEATLAS_VERSION="$VERSION"
export GAMEATLAS_REPOSITORY="$REPOSITORY"
export GAMEATLAS_IMAGE_NAME="$IMAGE_NAME"
export GAMEATLAS_SIGNATURE_PATH="$RELEASE_SIGNATURE"
export GAMEATLAS_NOTES_PATH="$RELEASE_NOTES"

node <<'NODE'
const fs = require("fs");

const manifestPath = process.env.GAMEATLAS_MANIFEST_PATH;
const version = process.env.GAMEATLAS_VERSION;
const repository = process.env.GAMEATLAS_REPOSITORY;
const imageName = process.env.GAMEATLAS_IMAGE_NAME;
const signature = fs.readFileSync(process.env.GAMEATLAS_SIGNATURE_PATH, "utf8").trim();
const notesPath = process.env.GAMEATLAS_NOTES_PATH;
const notes = notesPath
  ? fs.readFileSync(notesPath, "utf8").trim()
  : `GameAtlas v${version}`;

if (!signature) throw new Error("The generated updater signature is empty");
if (!notes) throw new Error("Release notes are empty");

let platforms = {};
if (fs.existsSync(manifestPath)) {
  const raw = fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, "");
  const existing = JSON.parse(raw);
  if (String(existing.version ?? "").replace(/^v/, "") === version) {
    platforms = { ...(existing.platforms ?? {}) };
  }
}

const entry = {
  signature,
  url: `https://github.com/${repository}/releases/download/v${version}/${imageName}`
};

platforms["linux-x86_64"] = { ...entry };
platforms["linux-x86_64-appimage"] = { ...entry };

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const written = fs.readFileSync(manifestPath);
if (written[0] === 0xef && written[1] === 0xbb && written[2] === 0xbf) {
  throw new Error("latest.json contains a UTF-8 BOM");
}

const checked = JSON.parse(written.toString("utf8"));
for (const key of ["linux-x86_64", "linux-x86_64-appimage"]) {
  const candidate = checked.platforms?.[key];
  if (!candidate || candidate.signature !== signature || candidate.url !== entry.url) {
    throw new Error(`latest.json validation failed for ${key}`);
  }
}
NODE

unset GAMEATLAS_MANIFEST_PATH GAMEATLAS_VERSION GAMEATLAS_REPOSITORY \
  GAMEATLAS_IMAGE_NAME GAMEATLAS_SIGNATURE_PATH GAMEATLAS_NOTES_PATH

(
  cd "$RELEASE_DIR"
  sha256sum "$IMAGE_NAME" > SHA256SUMS-LINUX.txt
)

pass "Signed Linux release created and validated."
echo "  $RELEASE_IMAGE"
echo "  $RELEASE_SIGNATURE"
echo "  $MANIFEST_PATH"
echo "  $RELEASE_DIR/SHA256SUMS-LINUX.txt"
echo
echo "If the Windows script has already written the same release directory, its platform entry was preserved."

