import {
  invoke,
} from "@tauri-apps/api/core";


export async function getShaderCacheReport(
  game
) {
  return invoke(
    "get_shader_cache_report",
    {
      installPath:
        game?.installPath
        ?? null,

      launcherId:
        game?.launcherId
        ?? null,

      steamLibraryPath:
        game?.steamLibraryPath
        ?? null,
    }
  );
}


export async function clearShaderCacheTargets(
  game,
  ids
) {
  return invoke(
    "clear_shader_cache_targets",
    {
      selection: {
        ids,
        installPath:
          game?.installPath
          ?? null,

        launcherId:
          game?.launcherId
          ?? null,

        steamLibraryPath:
          game?.steamLibraryPath
          ?? null,
      },
    }
  );
}
