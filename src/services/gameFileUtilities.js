import {
  invoke,
} from "@tauri-apps/api/core";


export async function inspectGameUtilityDirectories(
  game
) {
  if (
    !game?.installPath
  ) {
    return {
      logDirectory:
        null,

      crashDirectory:
        null,

      shaderCacheDirectory:
        null,

      directoriesVisited:
        0,

      scanTruncated:
        false,
    };
  }

  return invoke(
    "inspect_game_utility_directories",
    {
      installPath:
        game.installPath,
    }
  );
}
