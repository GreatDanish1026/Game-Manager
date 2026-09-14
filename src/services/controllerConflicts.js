import {
  invoke,
} from "@tauri-apps/api/core";


export async function getControllerConflictReport() {
  return invoke(
    "get_controller_conflict_report"
  );
}
