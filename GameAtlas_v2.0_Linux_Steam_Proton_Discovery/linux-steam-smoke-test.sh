#!/usr/bin/env bash
set -euo pipefail

echo "GameAtlas 2.0 - Linux Steam/Proton smoke checks"
echo

for p in \
  "$HOME/.steam/steam" \
  "$HOME/.local/share/Steam" \
  "$HOME/.var/app/com.valvesoftware.Steam/data/Steam"
do
  if [ -d "$p/steamapps" ]; then
    echo "[PASS] Steam root: $p"
  fi
done

echo
echo "Steam libraries:"
find "$HOME/.steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam" \
  -name libraryfolders.vdf -print 2>/dev/null | head -20 || true

echo
echo "Installed manifests:"
find "$HOME/.steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam" \
  -name 'appmanifest_*.acf' -print 2>/dev/null | head -30 || true

echo
echo "Proton prefixes:"
find "$HOME/.steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam" \
  -path '*/steamapps/compatdata/*/pfx' -type d -print 2>/dev/null | head -30 || true

echo
echo "Compatibility tools:"
find "$HOME/.steam" "$HOME/.local/share/Steam" "$HOME/.var/app/com.valvesoftware.Steam" \
  -type d \( -path '*/steamapps/common/Proton*' -o -path '*/compatibilitytools.d/*' \) \
  -print 2>/dev/null | head -30 || true
