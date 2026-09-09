import {
  invoke,
} from "@tauri-apps/api/core";


import {
  applyLibraryOverride,
} from "./libraryOverrides";


function gameIdentity(
  game
) {
  const store =
    String(
      game?.store
      ?? ""
    )
    .trim()
    .toLowerCase();

  const launcherId =
    String(
      game?.launcherId
      ?? game?.id
      ?? ""
    )
    .trim()
    .toLowerCase();

  return `${store}:${launcherId}`;
}


export async function getInstalledGames() {
  /*
   * EA discovery is deliberately isolated from the existing scanner.
   * A problem reading EA's registry must never stop Steam/Epic/GOG/
   * Ubisoft games from loading.
   */
  const [
    existingResult,
    eaResult,
    xboxResult,
  ] =
    await Promise.allSettled([
      invoke(
        "get_installed_games"
      ),

      invoke(
        "get_ea_installed_games"
      ),

      invoke(
        "get_xbox_installed_games"
      ),
    ]);


  if (
    existingResult.status
    !== "fulfilled"
  ) {
    throw existingResult.reason;
  }


  const existing =
    Array.isArray(
      existingResult.value
    )
      ? existingResult.value
      : [];


  const eaGames =
    eaResult.status
      === "fulfilled"
      && Array.isArray(
        eaResult.value
      )
      ? eaResult.value
      : [];


  const xboxGames =
    xboxResult.status
      === "fulfilled"
      && Array.isArray(
        xboxResult.value
      )
      ? xboxResult.value
      : [];


  const merged =
    new Map();


  for (const game of [
    ...existing,
    ...eaGames,
    ...xboxGames,
  ]) {
    const key =
      gameIdentity(
        game
      );

    if (!key.endsWith(":")) {
      merged.set(
        key,
        game
      );
    }
  }


  return Array.from(
    merged.values()
  ).map(
    applyLibraryOverride
  );
}


const LAUNCHER_STORE_ALIASES = {
  steam: [
    "steam",
  ],

  epic: [
    "epic",
    "epic games",
    "epic games launcher",
  ],

  ea: [
    "ea",
    "ea app",
    "origin",
    "origin games",
  ],

  gog: [
    "gog",
    "gog galaxy",
  ],

  ubisoft: [
    "ubisoft",
    "ubisoft connect",
    "uplay",
  ],

  xbox: [
    "xbox",
    "microsoft store",
    "xbox / microsoft store",
    "xbox app",
  ],
};


export function gameMatchesLauncher(
  game,
  launcherId
) {
  const normalizedLauncher =
    String(
      launcherId
      ?? ""
    )
    .trim()
    .toLowerCase();

  const store =
    String(
      game?.store
      ?? ""
    )
    .trim()
    .toLowerCase();

  return (
    LAUNCHER_STORE_ALIASES[
      normalizedLauncher
    ]
    ?? []
  ).includes(
    store
  );
}


export async function getInstalledGamesForLauncher(
  launcherId
) {
  const normalizedLauncher =
    String(
      launcherId
      ?? ""
    )
    .trim()
    .toLowerCase();


  if (
    !LAUNCHER_STORE_ALIASES[
      normalizedLauncher
    ]
  ) {
    throw new Error(
      `Unsupported launcher: ${launcherId}`
    );
  }


  if (
    normalizedLauncher
    === "ea"
    || normalizedLauncher
      === "xbox"
  ) {
    const command =
      normalizedLauncher
        === "ea"
        ? "get_ea_installed_games"
        : "get_xbox_installed_games";

    const result =
      await invoke(
        command
      );

    return (
      Array.isArray(
        result
      )
        ? result
        : []
    ).map(
      applyLibraryOverride
    );
  }


  const result =
    await invoke(
      "get_installed_games"
    );

  const games =
    Array.isArray(
      result
    )
      ? result
      : [];


  return games
    .filter(
      (game) =>
        gameMatchesLauncher(
          game,
          normalizedLauncher
        )
    )
    .map(
      applyLibraryOverride
    );
}
