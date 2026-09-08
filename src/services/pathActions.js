import {
  invoke,
} from "@tauri-apps/api/core";


export async function openGamePath(
  path,
  installPath = null
) {
  if (
    !path
    || !String(path).trim()
  ) {
    throw new Error(
      "No path is available."
    );
  }

  return invoke(
    "open_game_path",
    {
      path:
        String(path),

      installPath:
        installPath
          ? String(
              installPath
            )
          : null,
    }
  );
}
