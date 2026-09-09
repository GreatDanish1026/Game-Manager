import {
  invoke,
} from "@tauri-apps/api/core";


export async function getRenoDxModStatus(
  game
) {
  console.log(
    "[HDR Mods] Checking:",
    game.name
  );

  const result =
    await invoke(
      "get_renodx_mod_status",
      {
        name:
          game.name,
      }
    );

  console.log(
    "[HDR Mods] Result:",
    result
  );

  return result;
}