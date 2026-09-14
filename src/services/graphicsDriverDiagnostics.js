import {
  invoke,
} from "@tauri-apps/api/core";


export async function getGraphicsDriverDiagnostics() {
  return invoke(
    "get_graphics_driver_diagnostics"
  );
}
