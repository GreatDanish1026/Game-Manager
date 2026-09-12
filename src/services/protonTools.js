import {
  invoke,
} from "@tauri-apps/api/core";


export async function getProtonToolActions() {
  return invoke(
    "get_proton_tool_actions"
  );
}


export async function openProtonToolboxPath(
  path
) {
  if (
    !path
    || !String(
      path
    ).trim()
  ) {
    throw new Error(
      "No path was provided."
    );
  }

  return invoke(
    "open_proton_toolbox_path",
    {
      path:
        String(
          path
        ),
    }
  );
}


export async function launchProtontricksGui() {
  return invoke(
    "launch_protontricks_gui"
  );
}


export async function launchSteamWinecfg(
  steamAppId
) {
  return invoke(
    "launch_steam_winecfg",
    {
      steamAppId,
    }
  );
}


export async function launchWinetricksGui(
  prefixPath
) {
  return invoke(
    "launch_winetricks_gui",
    {
      prefixPath,
    }
  );
}
