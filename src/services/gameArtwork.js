export function getGameCoverArt(game) {
  if (!game) {
    return null;
  }

  const explicitCover =
    game.coverImageUrl
    ?? game.coverArtUrl
    ?? game.coverUrl
    ?? game.imageUrl
    ?? null;

  if (explicitCover) {
    return explicitCover;
  }

  const store =
    String(game.store ?? "")
      .trim()
      .toLowerCase();

  const launcherId =
    String(game.launcherId ?? "")
      .trim();

  if (store === "steam" && launcherId) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${launcherId}/library_600x900.jpg`;
  }

  return null;
}

function isLocalArtworkUrl(value) {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (!url || url.startsWith("//")) return false;

  return /^(data:image\/(?:png|jpe?g|webp|gif|avif|bmp)[;,]|blob:|asset:|tauri:|file:)/i.test(url)
    || /^https?:\/\/asset\.localhost(?:\/|$)/i.test(url)
    || /^(\/|\.\/|\.\.\/)[^/]/.test(url);
}

export function getGameFallbackInitial(game) {
  return String(game?.name ?? "").trim().charAt(0).toLocaleUpperCase() || "?";
}

export function getLocalGameArtwork(game) {
  if (!game) return null;

  return [
    game.iconUrl,
    game.coverImageUrl,
    game.coverArtUrl,
    game.coverUrl,
    game.imageUrl,
  ].find(isLocalArtworkUrl) ?? null;
}

export function getGameListArtworkCandidates(game) {
  const localArtwork = getLocalGameArtwork(game);
  const candidates = localArtwork ? [localArtwork] : [];

  const store = String(game?.store ?? "").trim().toLowerCase();
  const steamAppId = String(store === "steam" ? game?.launcherId : game?.steamAppId ?? "").trim();
  if (!/^\d+$/.test(steamAppId)) return candidates;

  return [...candidates, ...getSteamArtworkCandidates(steamAppId)];
}

export function getSteamArtworkCandidates(appId) {
  if (!/^\d+$/.test(String(appId))) return [];
  const steamBase = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}`;
  return [`${steamBase}/library_600x900.jpg`, `${steamBase}/library_hero.jpg`];
}
