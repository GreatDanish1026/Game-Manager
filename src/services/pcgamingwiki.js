import {
  invoke,
} from "@tauri-apps/api/core";

export async function getPcGamingWikiData(
  game
) {
  console.log(
    "[PCGW] Requesting data for:",
    game
  );

  const result =
    await invoke(
      "get_pcgw_game_data",
      {
        name:
          game.name,

        store:
          game.store,

        launcherId:
          game.launcherId ??
          null,
      }
    );

  console.log(
    "[PCGW] Rust returned:",
    result
  );

  return result;
}