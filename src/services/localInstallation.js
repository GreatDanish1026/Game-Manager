import {
  invoke,
} from "@tauri-apps/api/core";


const cache =
  new Map();


function cacheKey(
  game
) {
  return [
    game?.id
      ?? "",
    game?.installPath
      ?? "",
    game?.technical
      ?.saveLocation
      ?? "",
    game?.technical
      ?.configLocation
      ?? "",
    game?.store
      ?? "",
    game?.launcherId
      ?? "",
  ].join(
    "::"
  );
}


export async function inspectLocalInstallation(
  game,
  {
    force = false,
  } = {}
) {
  const key =
    cacheKey(
      game
    );

  if (
    !force
    && cache.has(
      key
    )
  ) {
    return cache.get(
      key
    );
  }

  const promise =
    invoke(
      "inspect_local_installation",
      {
        gameName:
          game.name,

        installPath:
          game.installPath,

        savePath:
          game.technical
            ?.saveLocation
          ?? null,

        configPath:
          game.technical
            ?.configLocation
          ?? null,

        store:
          game.store
          ?? null,

        launcherId:
          game.launcherId
          ?? null,
      }
    )
    .catch(
      (error) => {
        cache.delete(
          key
        );

        throw error;
      }
    );

  cache.set(
    key,
    promise
  );

  return promise;
}


export function clearLocalInstallationCache(
  game
) {
  if (!game) {
    cache.clear();

    return;
  }

  cache.delete(
    cacheKey(
      game
    )
  );
}
