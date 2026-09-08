Game Manager - Fluffy Mod Manager Support Update

Files included:
  src/App.jsx
  src/components/GameDetails.jsx
  src/components/FluffyCard.jsx
  src/services/fluffy.js
  src-tauri/src/fluffy.rs
  src-tauri/src/lib.rs

What this adds:
- A Fluffy Mod Manager support card directly below the Vortex card.
- A Tauri backend command that checks a conservative list of known supported games.
- Title normalization for trademark symbols, punctuation, and storefront suffixes.
- Parallel Fluffy lookup alongside PCGamingWiki, RenoDX/Luma, and Vortex.
- A button that opens the Fluffy Mod Manager Nexus Mods page.

Important:
- Fluffy does not expose a Vortex-style public machine-readable support manifest.
- The support list is intentionally centralized in src-tauri/src/fluffy.rs so it can be updated easily.

After replacing files:
  cd "C:\Game Apps\Game Manager\Rust\GameManager\src-tauri"
  cargo check

  cd ..
  npm run build
  npm run tauri:dev
