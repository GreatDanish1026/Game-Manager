import {
  invoke,
} from "@tauri-apps/api/core";


export async function getFluffySupport(
  game
) {
  console.log(
    "[Fluffy] Checking:",
    game.name
  );


  const result =
    await invoke(
      "get_fluffy_support",
      {
        name:
          game.name,
      }
    );


  console.log(
    "[Fluffy] Result:",
    result
  );


  return result;
}
