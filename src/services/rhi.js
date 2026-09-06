import {
  invoke,
} from "@tauri-apps/api/core";

export async function getRhiStatus() {
  console.log(
    "[RHI] Checking installation..."
  );

  const result =
    await invoke(
      "get_rhi_status"
    );

  console.log(
    "[RHI] Status:",
    result
  );

  return result;
}

export async function launchRhi() {
  console.log(
    "[RHI] Launch requested"
  );

  await invoke(
    "launch_rhi"
  );
}