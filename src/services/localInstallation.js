import {
  invoke,
} from "@tauri-apps/api/core";


export async function inspectLocalInstallation(
  game
) {
  return invoke(
    "inspect_local_installation",
    {
      gameName:
        game.name,

      installPath:
        game.installPath,
    }
  );
}
