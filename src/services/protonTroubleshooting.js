import {
  invoke,
} from "@tauri-apps/api/core";


function gameKey(
  game
) {
  return String(
    game?.launcherId
    ?? game?.id
    ?? game?.name
    ?? "game"
  );
}


export async function getProtonTroubleshootingInfo(
  game,
  toolbox
) {
  return invoke(
    "get_proton_troubleshooting_info",
    {
      gameKey:
        gameKey(
          game
        ),

      store:
        game?.store
        ?? null,

      source:
        game?.source
        ?? null,

      steamAppId:
        toolbox?.steamAppId
        ?? game?.launcherId
        ?? null,

      prefixPath:
        toolbox?.prefix?.prefixPath
        ?? null,

      runtimeName:
        toolbox?.runtimeInUse?.name
        ?? null,

      runtimePath:
        toolbox?.runtimeInUse?.path
        ?? null,

      runtimeSource:
        toolbox?.runtimeInUse?.source
        ?? null,
    }
  );
}


export async function saveLastKnownWorkingRuntime(
  game,
  toolbox
) {
  return invoke(
    "save_last_known_working_runtime",
    {
      gameKey:
        gameKey(
          game
        ),

      store:
        game?.store
        ?? null,

      source:
        game?.source
        ?? null,

      runtimeName:
        toolbox?.runtimeInUse?.name
        ?? "",

      runtimePath:
        toolbox?.runtimeInUse?.path
        ?? null,
    }
  );
}
