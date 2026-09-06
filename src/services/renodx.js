import {
  invoke,
} from "@tauri-apps/api/core";

export async function getRenoDxModStatus(
  game
) {
  console.log(
    "[RenoDX] Checking:",
    game.name
  );

  const result =
    await invoke(
      "get_renodx_mod_status",
      {
        name: game.name,
      }
    );

  console.log(
    "[RenoDX] Result:",
    result
  );

  return result;
}