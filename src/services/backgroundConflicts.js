import {
  invoke,
} from "@tauri-apps/api/core";


export async function getBackgroundConflictReport() {
  return invoke(
    "get_background_conflict_report"
  );
}
