import { invoke } from "@tauri-apps/api/core";

export async function getProtonToolboxInfo(game) {
  return invoke(
    "get_proton_toolbox_info",
    {
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

      runtime:
        game?.runtime
        ?? null,

      lutrisRunner:
        game?.lutrisRunner
        ?? null,

      lutrisSlug:
        game?.lutrisSlug
        ?? null,
    }
  );
}
