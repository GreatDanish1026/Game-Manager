import {
  invoke,
} from "@tauri-apps/api/core";


export async function getCleanLaunchStatus() {
  return invoke(
    "get_clean_launch_status"
  );
}


export async function prepareCleanLaunch(
  ids
) {
  return invoke(
    "prepare_clean_launch",
    {
      selection: {
        ids,
      },
    }
  );
}


export async function restoreCleanLaunchApps() {
  return invoke(
    "restore_clean_launch_apps"
  );
}
