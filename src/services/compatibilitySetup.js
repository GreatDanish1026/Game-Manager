import {
  invoke,
} from "@tauri-apps/api/core";

import {
  displayGameVersion,
  getGameVersionState,
} from "./gameVersions";


const STORAGE_KEY =
  "game-manager-known-good-setups-v1";

const CHANGED_EVENT =
  "game-manager-known-good-setups-changed";


function gameId(
  game
) {
  return String(
    game?.id
    ?? ""
  ).trim();
}


function loadAll() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) {
      return {};
    }

    const parsed =
      JSON.parse(
        raw
      );

    return parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function saveAll(
  value
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      value
    )
  );

  window.dispatchEvent(
    new CustomEvent(
      CHANGED_EVENT
    )
  );
}


function text(
  value
) {
  return String(
    value
    ?? ""
  ).trim();
}


function booleanOrNull(
  value
) {
  return value === true
    ? true
    : value === false
      ? false
      : null;
}


export function emptyKnownGoodSetup() {
  return {
    resolution:
      "",

    graphicsPreset:
      "",

    targetFps:
      "",

    upscaling:
      "",

    frameGeneration:
      null,

    rayTracing:
      null,

    hdr:
      null,

    gameVersion:
      "",

    driverVersion:
      "",

    notes:
      "",

    verifiedAt:
      null,
  };
}


export function getKnownGoodSetup(
  game
) {
  const id =
    gameId(
      game
    );

  if (!id) {
    return emptyKnownGoodSetup();
  }

  const stored =
    loadAll()[id];

  if (
    !stored
    || typeof stored
      !== "object"
  ) {
    return emptyKnownGoodSetup();
  }

  return {
    ...emptyKnownGoodSetup(),
    ...stored,

    frameGeneration:
      booleanOrNull(
        stored.frameGeneration
      ),

    rayTracing:
      booleanOrNull(
        stored.rayTracing
      ),

    hdr:
      booleanOrNull(
        stored.hdr
      ),
  };
}


export function saveKnownGoodSetup(
  game,
  setup
) {
  const id =
    gameId(
      game
    );

  if (!id) {
    return;
  }

  const all =
    loadAll();

  all[id] = {
    resolution:
      text(
        setup.resolution
      ),

    graphicsPreset:
      text(
        setup.graphicsPreset
      ),

    targetFps:
      text(
        setup.targetFps
      ),

    upscaling:
      text(
        setup.upscaling
      ),

    frameGeneration:
      booleanOrNull(
        setup.frameGeneration
      ),

    rayTracing:
      booleanOrNull(
        setup.rayTracing
      ),

    hdr:
      booleanOrNull(
        setup.hdr
      ),

    gameVersion:
      text(
        setup.gameVersion
      ),

    driverVersion:
      text(
        setup.driverVersion
      ),

    notes:
      text(
        setup.notes
      ),

    verifiedAt:
      setup.verifiedAt
      ?? null,
  };

  saveAll(
    all
  );
}


export function markKnownGoodVerified(
  game,
  setup
) {
  const version =
    displayGameVersion(
      getGameVersionState(
        game
      )
    );

  const next = {
    ...setup,

    gameVersion:
      text(
        setup.gameVersion
      )
      || (
        version.value
          !== "Unknown"
            ? version.value
            : ""
      ),

    verifiedAt:
      new Date()
        .toISOString(),
  };

  saveKnownGoodSetup(
    game,
    next
  );

  return next;
}


function truthyFeature(
  value
) {
  if (
    value === true
  ) {
    return true;
  }

  if (
    value === false
    || value === null
    || value === undefined
  ) {
    return false;
  }

  const normalized =
    String(
      value
    )
      .trim()
      .toLowerCase();

  return [
    "yes",
    "true",
    "supported",
    "native",
    "available",
    "enabled",
  ].includes(
    normalized
  );
}


function gameCapabilitySummary(
  game
) {
  const features =
    game?.features
    ?? {};

  return {
    hdr:
      truthyFeature(
        features.hdr
        ?? game?.technical?.hdr
      ),

    rayTracing:
      truthyFeature(
        features.rayTracing
        ?? features.ray_tracing
        ?? game?.technical?.rayTracing
      ),

    upscaling:
      truthyFeature(
        features.upscaling
      )
      || truthyFeature(
        features.dlss
      )
      || truthyFeature(
        features.fsr
      )
      || truthyFeature(
        features.xess
      ),

    frameGeneration:
      truthyFeature(
        features.frameGeneration
        ?? features.frame_generation
        ?? features.dlssFrameGeneration
        ?? features.dlss_frame_generation
      ),

    fourK:
      truthyFeature(
        features.fourK
        ?? features["4k"]
      ),

    highRefresh:
      truthyFeature(
        features.highRefresh
        ?? features["120fps"]
        ?? features.highFrameRate
      ),
  };
}


function bestGpu(
  hardware
) {
  const gpus =
    Array.isArray(
      hardware?.gpus
    )
      ? hardware.gpus
      : [];

  if (gpus.length === 0) {
    return null;
  }

  return [
    ...gpus,
  ].sort(
    (
      left,
      right
    ) =>
      Number(
        right?.dedicatedMemoryBytes
        ?? 0
      )
      - Number(
          left?.dedicatedMemoryBytes
          ?? 0
        )
  )[0];
}


function gb(
  bytes
) {
  const value =
    Number(
      bytes
      ?? 0
    );

  if (
    !Number.isFinite(
      value
    )
    || value <= 0
  ) {
    return null;
  }

  return value
    / 1024
    / 1024
    / 1024;
}


function scoreSystem(
  game,
  hardware
) {
  const gpu =
    bestGpu(
      hardware
    );

  const caps =
    gameCapabilitySummary(
      game
    );

  const ramGb =
    gb(
      hardware?.ramBytes
    );

  const vramGb =
    gb(
      gpu?.dedicatedMemoryBytes
    );

  let score = 0;
  const positives = [];
  const cautions = [];

  if (gpu) {
    score += 2;

    positives.push(
      `Detected GPU: ${gpu.name}.`
    );
  } else {
    cautions.push(
      "No discrete GPU information was available."
    );
  }

  if (
    gpu?.nvidiaRtx
    || gpu?.amdRayTracingClass
    || gpu?.intelArc
  ) {
    score += 2;

    positives.push(
      "Modern graphics-feature hardware class detected."
    );
  }

  if (
    vramGb !== null
  ) {
    if (vramGb >= 12) {
      score += 2;

      positives.push(
        `${Math.round(
          vramGb
        )} GB of detected dedicated graphics memory provides strong headroom.`
      );
    } else if (vramGb >= 8) {
      score += 1;

      positives.push(
        `${Math.round(
          vramGb
        )} GB of detected dedicated graphics memory is a solid baseline.`
      );
    } else {
      cautions.push(
        `${vramGb.toFixed(
          1
        )} GB of detected graphics memory may limit high-resolution texture settings in demanding games.`
      );
    }
  }

  if (
    ramGb !== null
  ) {
    if (ramGb >= 32) {
      score += 2;

      positives.push(
        `${Math.round(
          ramGb
        )} GB of system RAM provides ample capacity.`
      );
    } else if (ramGb >= 16) {
      score += 1;

      positives.push(
        `${Math.round(
          ramGb
        )} GB of system RAM meets the common modern-gaming baseline.`
      );
    } else {
      cautions.push(
        `${Math.round(
          ramGb
        )} GB of system RAM may be restrictive for newer titles.`
      );
    }
  }

  if (
    caps.rayTracing
  ) {
    if (
      gpu?.nvidiaRtx
      || gpu?.amdRayTracingClass
      || gpu?.intelArc
    ) {
      score += 1;

      positives.push(
        "The game exposes ray tracing and compatible hardware-class support is detected."
      );
    } else {
      cautions.push(
        "The game exposes ray tracing, but compatible RT-class hardware was not identified."
      );
    }
  }

  if (
    caps.frameGeneration
  ) {
    if (
      gpu?.nvidiaFrameGenerationCapable
    ) {
      score += 1;

      positives.push(
        "The game exposes frame generation and NVIDIA frame-generation-capable hardware is detected."
      );
    } else {
      cautions.push(
        "The game exposes frame generation, but GameAtlas cannot confirm matching frame-generation hardware."
      );
    }
  }

  if (
    caps.upscaling
  ) {
    score += 1;

    positives.push(
      "Upscaling support gives additional performance flexibility."
    );
  }

  if (
    caps.fourK
  ) {
    if (
      vramGb !== null
      && vramGb >= 10
    ) {
      score += 1;

      positives.push(
        "4K support is listed and detected VRAM is favorable for high-resolution play."
      );
    } else {
      cautions.push(
        "4K support is listed, but GameAtlas does not have enough evidence to call 4K performance strong."
      );
    }
  }

  let tier =
    "Unknown";

  let tone =
    "neutral";

  if (!gpu) {
    tier =
      "Unknown";
  } else if (score >= 9) {
    tier =
      "Excellent";

    tone =
      "excellent";
  } else if (score >= 6) {
    tier =
      "Good";

    tone =
      "good";
  } else {
    tier =
      "Compatible";

    tone =
      "compatible";
  }

  return {
    tier,
    tone,
    score,
    positives,
    cautions,
    hardware: {
      cpuName:
        hardware?.cpuName
        ?? null,

      ramGb,

      gpuName:
        gpu?.name
        ?? null,

      vramGb,
    },

    capabilities:
      caps,

    disclaimer:
      "This is a capability-fit estimate, not an FPS benchmark. Game settings, drivers, patches, CPU limits, thermals, and mods can materially change real performance.",
  };
}


export async function getSystemCompatibilityEstimate(
  game
) {
  const hardware =
    await invoke(
      "get_system_hardware"
    );

  return scoreSystem(
    game,
    hardware
  );
}


export const KNOWN_GOOD_SETUP_CHANGED_EVENT =
  CHANGED_EVENT;
