import {
  invoke,
} from "@tauri-apps/api/core";

import {
  inspectLocalInstallation,
} from "./localInstallation";


export async function getModConflictReport(
  game
) {
  const local =
    await inspectLocalInstallation(
      game
    );

  const installPath =
    local?.installPath
    ?? game?.installPath;

  if (!installPath) {
    throw new Error(
      "GameAtlas could not identify this game's installation folder."
    );
  }

  return invoke(
    "inspect_mod_conflicts",
    {
      installPath,
      executablePath:
        local?.executable
          ?.path
        ?? null,
    }
  );
}
