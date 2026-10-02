import { invoke } from "@tauri-apps/api/core";
import { getSettings } from "./settings";

export const getLaunchProcesses = () => invoke("get_launch_processes");
export const closeLaunchProcesses = (targets) => invoke("close_launch_processes", { targets });
export async function restoreLaunchApps() {
  const result = await invoke("restore_launch_apps");
  window.dispatchEvent(new CustomEvent("gameatlas-launch-apps-closed", { detail: { count: result.restorableCount ?? 0 } }));
  return result;
}
export const getLaunchRestoreCount = () => invoke("get_launch_restore_count");

const reportedBytes = (value) => Number.isFinite(value) ? Math.max(0, value) : -1;

export function sortLaunchProcessesByVram(processes) {
  return [...processes].sort((left, right) =>
    reportedBytes(right.dedicatedBytes) - reportedBytes(left.dedicatedBytes)
    || reportedBytes(right.sharedBytes) - reportedBytes(left.sharedBytes)
    || reportedBytes(right.ramBytes) - reportedBytes(left.ramBytes)
    || left.name.localeCompare(right.name)
    || left.pid - right.pid
  );
}

let reviewInProgress = false;

export async function reviewBeforeGameLaunch(game) {
  const settings = getSettings();
  if (!settings.launchCleanupEnabled && !settings.preLaunchMemoryReview) return;
  if (!settings.preLaunchMemoryReview && settings.launchCleanupPaths.length === 0) return;
  if (typeof window === "undefined") return;
  if (reviewInProgress) throw new Error("Another pre-launch review is already open.");

  reviewInProgress = true;
  let result;
  try {
    result = await new Promise((resolve) => {
      window.dispatchEvent(new CustomEvent("gameatlas-prelaunch-review", {
        detail: { gameName: game?.name ?? "this game", settings, resolve },
      }));
    });
  } finally {
    reviewInProgress = false;
  }
  if (!result) throw new Error("Game launch cancelled during pre-launch review.");
}
