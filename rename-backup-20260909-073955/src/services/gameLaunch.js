import {
  invoke,
} from "@tauri-apps/api/core";


export async function launchGame(
  game
) {
  return invoke(
    "launch_game",
    {
      name:
        game.name,

      store:
        game.store,

      launcherId:
        game.launcherId
        ?? null,

      gameId:
        game.id
        ?? null,

      installPath:
        game.installPath
        ?? "",
    }
  );
}
