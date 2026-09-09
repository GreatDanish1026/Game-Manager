import {
  invoke,
} from "@tauri-apps/api/core";


let cachedPromise =
  null;


export async function getSystemHardware({
  force = false,
} = {}) {
  if (
    !force
    && cachedPromise
  ) {
    return cachedPromise;
  }

  cachedPromise =
    invoke(
      "get_system_hardware"
    )
    .catch(
      (error) => {
        cachedPromise =
          null;

        throw error;
      }
    );

  return cachedPromise;
}
