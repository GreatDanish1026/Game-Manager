import { invoke } from "@tauri-apps/api/core";

function normalizeStore(game) {
  return String(
    game?.store
    ?? game?.source
    ?? ""
  )
    .trim()
    .toLowerCase();
}

export function getSteamAppId(game) {
  if (!game) return null;

  if (normalizeStore(game) !== "steam") {
    return null;
  }

  const candidates = [
    game.launcherId,
    game.appId,
    game.steamAppId,
    game.steamAppid,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();

    if (/^\d+$/.test(value)) {
      return value;
    }
  }

  return null;
}

export async function getSteamCommunityRating(game) {
  const appId = getSteamAppId(game);
  if (!appId) return null;

  return invoke(
    "get_steam_community_rating",
    { appId }
  );
}
