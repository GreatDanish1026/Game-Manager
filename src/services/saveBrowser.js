import {
  invoke,
} from "@tauri-apps/api/core";


export async function inspectSaveBrowser(
  game
) {
  const savePath =
    game?.technical
      ?.saveLocation;

  if (!savePath) {
    throw new Error(
      "PCGamingWiki did not report a save location for this game."
    );
  }

  return invoke(
    "inspect_save_browser",
    {
      savePath,

      installPath:
        game?.installPath
        ?? null,

      protonPrefix:
        game?.protonPrefix
        ?? null,
    }
  );
}
