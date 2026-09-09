import {
  invoke,
} from "@tauri-apps/api/core";


export async function getLauncherStatus() {
  return invoke(
    "get_launcher_status"
  );
}
