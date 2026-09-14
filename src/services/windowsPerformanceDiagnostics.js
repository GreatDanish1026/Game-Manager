import {
  invoke,
} from "@tauri-apps/api/core";


export async function getWindowsPerformanceDiagnostics(
  game
) {
  return invoke(
    "get_windows_performance_diagnostics",
    {
      installPath:
        game?.installPath
        ?? null,
    }
  );
}
