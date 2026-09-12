import {
  invoke,
} from "@tauri-apps/api/core";


function gameArguments(
  game
) {
  return {
    store:
      game?.store
      ?? null,

    launcherId:
      game?.launcherId
      ?? null,

    installPath:
      game?.installPath
      ?? null,

    source:
      game?.source
      ?? null,

    lutrisSlug:
      game?.lutrisSlug
      ?? null,
  };
}


export async function setProtonRuntimeOverride(
  game,
  runtime
) {
  return invoke(
    "set_proton_runtime_override",
    {
      ...gameArguments(
        game
      ),

      runtimeName:
        runtime?.name
        ?? "",

      runtimePath:
        runtime?.path
        ?? "",
    }
  );
}


export async function clearProtonRuntimeOverride(
  game
) {
  return invoke(
    "clear_proton_runtime_override",
    gameArguments(
      game
    )
  );
}
