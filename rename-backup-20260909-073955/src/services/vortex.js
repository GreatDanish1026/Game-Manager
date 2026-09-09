import {
  invoke,
} from "@tauri-apps/api/core";


export async function getVortexSupport(
  game
) {
  console.log(
    "[Vortex] Checking:",
    game.name
  );


  const result =
    await invoke(
      "get_vortex_support",
      {
        name:
          game.name,
      }
    );


  console.log(
    "[Vortex] Result:",
    result
  );


  return result;
}