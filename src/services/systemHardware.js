import {
  invoke,
} from "@tauri-apps/api/core";

let cachedPromise = null;

function gpuScore(gpu) {
  if (!gpu) {
    return -10000;
  }

  const name = String(gpu.name ?? "").toLowerCase();
  const vendor = String(gpu.vendor ?? "").toLowerCase();
  const memory = Number(
    gpu.dedicatedMemoryBytes
    ?? gpu.memoryBytes
    ?? 0
  ) || 0;

  let score = 0;

  if (memory > 0) {
    score += Math.min(
      memory / (1024 * 1024 * 1024),
      64
    ) * 100;
  }

  if (
    gpu.nvidiaRtx
    || name.includes("geforce rtx")
    || name.includes("geforce gtx")
  ) {
    score += 10000;
  }

  if (name.includes("radeon rx")) {
    score += 9000;
  }

  if (
    gpu.intelArc
    || name.includes("intel arc")
  ) {
    score += 8500;
  }

  if (
    vendor === "nvidia"
    || name.includes("nvidia")
  ) {
    score += 7000;
  }

  if (
    name.includes("raphael")
    || name.includes("integrated")
    || name.includes("igpu")
    || name.includes("uhd graphics")
    || name.includes("iris xe")
  ) {
    score -= 12000;
  }

  return score;
}

function normalizeHardware(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const gpus = Array.isArray(value.gpus)
    ? [...value.gpus]
    : [];

  gpus.sort(
    (left, right) =>
      gpuScore(right) - gpuScore(left)
  );

  return {
    ...value,
    gpus,
    primaryGpu: gpus[0] ?? null,
  };
}

export async function getSystemHardware({
  force = false,
} = {}) {
  if (!force && cachedPromise) {
    return cachedPromise;
  }

  cachedPromise =
    invoke("get_system_hardware")
      .then(normalizeHardware)
      .catch((error) => {
        cachedPromise = null;
        throw error;
      });

  return cachedPromise;
}
