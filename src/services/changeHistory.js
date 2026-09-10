const STORAGE_KEY =
  "game-manager-change-history-v1";

const MAX_EVENTS_PER_GAME =
  100;


function gameKey(
  game
) {
  if (game?.id) {
    return String(
      game.id
    );
  }

  const store =
    String(
      game?.store
      ?? "unknown"
    )
      .trim()
      .toLowerCase();

  const launcherId =
    String(
      game?.launcherId
      ?? ""
    )
      .trim();

  if (launcherId) {
    return `${store}:${launcherId}`;
  }

  return `${store}:${String(
    game?.name
    ?? "unknown-game"
  )
    .trim()
    .toLowerCase()}`;
}


function readStore() {
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
      && typeof parsed
        === "object"
      && !Array.isArray(
        parsed
      )
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function writeStore(
  value
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(
      value
    )
  );
}


function scalar(
  value
) {
  if (
    value === undefined
    || value === null
  ) {
    return null;
  }

  if (
    typeof value
      === "boolean"
  ) {
    return value;
  }

  if (
    typeof value
      === "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  const text =
    String(
      value
    )
      .trim();

  return text
    || null;
}


function firstDefined(
  ...values
) {
  return values.find(
    (
      value
    ) =>
      value !== undefined
      && value !== null
  )
    ?? null;
}


export function buildChangeSnapshot(
  game,
  local,
  saveBrowser = null
) {
  const executable =
    local?.executable
    ?? {};

  const graphics =
    local?.graphics
    ?? {};

  const mods =
    local?.modManagers
    ?? {};

  const storage =
    local?.storageDetails
    ?? local?.storage
    ?? {};

  const screenshots =
    local?.screenshots
    ?? {};

  const specialK =
    local?.specialK
    ?? {};

  return {
    capturedAt:
      new Date()
        .toISOString(),

    installPath:
      scalar(
        local?.installPath
        ?? game?.installPath
      ),

    executableName:
      scalar(
        executable.fileName
      ),

    executablePath:
      scalar(
        executable.path
      ),

    executableArchitecture:
      scalar(
        executable.architecture
      ),

    executableSizeBytes:
      scalar(
        executable.sizeBytes
      ),

    filesScanned:
      scalar(
        local?.filesScanned
      ),

    installSizeBytes:
      scalar(
        firstDefined(
          storage.installSizeBytes,
          storage.installedSizeBytes,
          storage.totalSizeBytes
        )
      ),

    dlss:
      Boolean(
        graphics.dlss
      ),

    dlssVersion:
      scalar(
        graphics.dlssVersion
      ),

    dlssFrameGeneration:
      Boolean(
        graphics.dlssFrameGeneration
      ),

    xess:
      Boolean(
        graphics.xess
      ),

    xessVersion:
      scalar(
        graphics.xessVersion
      ),

    fsr:
      Boolean(
        graphics.fsr
      ),

    fsrVersion:
      scalar(
        graphics.fsrVersion
      ),

    reshadeInstalled:
      Boolean(
        local?.reshade
          ?.installed
      ),

    reshadePreset:
      scalar(
        local?.reshade
          ?.presetPath
      ),

    specialKDetected:
      Boolean(
        specialK.detected
      ),

    vortexEvidence:
      Boolean(
        mods.vortexEvidence
      ),

    fluffyEvidence:
      Boolean(
        mods.fluffyEvidence
      ),

    screenshotCount:
      scalar(
        screenshots.screenshotCount
      ),

    newestScreenshot:
      scalar(
        screenshots.newestFileName
      ),

    saveFileCount:
      scalar(
        saveBrowser?.fileCount
      ),

    saveSizeBytes:
      scalar(
        saveBrowser?.totalSizeBytes
      ),

    newestSave:
      scalar(
        saveBrowser
          ?.newestFile
          ?.relativePath
      ),

    newestSaveModifiedUnix:
      scalar(
        saveBrowser
          ?.newestFile
          ?.modifiedUnix
      ),

    engine:
      scalar(
        local?.technicalDetails
          ?.engine
        ?? game?.technical
          ?.engine
      ),

    graphicsApi:
      scalar(
        local?.technicalDetails
          ?.graphicsApi
        ?? local?.technicalDetails
          ?.api
        ?? game?.technical
          ?.api
      ),
  };
}


const FIELD_DEFINITIONS = [
  {
    key:
      "installPath",

    label:
      "Install location",

    category:
      "Installation",
  },

  {
    key:
      "installSizeBytes",

    label:
      "Install size",

    category:
      "Installation",

    format:
      "bytes",
  },

  {
    key:
      "filesScanned",

    label:
      "Scanned file count",

    category:
      "Installation",

    format:
      "number",
  },

  {
    key:
      "executableName",

    label:
      "Main executable",

    category:
      "Executable",
  },

  {
    key:
      "executablePath",

    label:
      "Executable path",

    category:
      "Executable",
  },

  {
    key:
      "executableArchitecture",

    label:
      "Executable architecture",

    category:
      "Executable",
  },

  {
    key:
      "executableSizeBytes",

    label:
      "Executable size",

    category:
      "Executable",

    format:
      "bytes",
  },

  {
    key:
      "engine",

    label:
      "Detected engine",

    category:
      "Technical",
  },

  {
    key:
      "graphicsApi",

    label:
      "Graphics API",

    category:
      "Technical",
  },

  {
    key:
      "dlss",

    label:
      "DLSS",

    category:
      "Graphics",

    format:
      "boolean",
  },

  {
    key:
      "dlssVersion",

    label:
      "DLSS version",

    category:
      "Graphics",
  },

  {
    key:
      "dlssFrameGeneration",

    label:
      "DLSS Frame Generation",

    category:
      "Graphics",

    format:
      "boolean",
  },

  {
    key:
      "xess",

    label:
      "XeSS",

    category:
      "Graphics",

    format:
      "boolean",
  },

  {
    key:
      "xessVersion",

    label:
      "XeSS version",

    category:
      "Graphics",
  },

  {
    key:
      "fsr",

    label:
      "FSR",

    category:
      "Graphics",

    format:
      "boolean",
  },

  {
    key:
      "fsrVersion",

    label:
      "FSR version",

    category:
      "Graphics",
  },

  {
    key:
      "reshadeInstalled",

    label:
      "ReShade",

    category:
      "Mods",

    format:
      "boolean",
  },

  {
    key:
      "reshadePreset",

    label:
      "ReShade preset",

    category:
      "Mods",
  },

  {
    key:
      "specialKDetected",

    label:
      "Special K",

    category:
      "Mods",

    format:
      "boolean",
  },

  {
    key:
      "vortexEvidence",

    label:
      "Vortex evidence",

    category:
      "Mods",

    format:
      "boolean",
  },

  {
    key:
      "fluffyEvidence",

    label:
      "Fluffy evidence",

    category:
      "Mods",

    format:
      "boolean",
  },

  {
    key:
      "screenshotCount",

    label:
      "Screenshot count",

    category:
      "Screenshots",

    format:
      "number",
  },

  {
    key:
      "newestScreenshot",

    label:
      "Newest screenshot",

    category:
      "Screenshots",
  },

  {
    key:
      "saveFileCount",

    label:
      "Save file count",

    category:
      "Saves",

    format:
      "number",
  },

  {
    key:
      "saveSizeBytes",

    label:
      "Save data size",

    category:
      "Saves",

    format:
      "bytes",
  },

  {
    key:
      "newestSave",

    label:
      "Newest save",

    category:
      "Saves",
  },

  {
    key:
      "newestSaveModifiedUnix",

    label:
      "Newest save modified",

    category:
      "Saves",

    format:
      "unix",
  },
];


function sameValue(
  left,
  right
) {
  return JSON.stringify(
    left
  )
    === JSON.stringify(
      right
    );
}


export function compareSnapshots(
  previous,
  current
) {
  if (!previous) {
    return [];
  }

  return FIELD_DEFINITIONS
    .filter(
      (
        definition
      ) =>
        !sameValue(
          previous[
            definition.key
          ],
          current[
            definition.key
          ]
        )
    )
    .map(
      (
        definition
      ) => ({
        key:
          definition.key,

        label:
          definition.label,

        category:
          definition.category,

        format:
          definition.format
          ?? "text",

        before:
          previous[
            definition.key
          ]
          ?? null,

        after:
          current[
            definition.key
          ]
          ?? null,
      })
    );
}


export function getChangeHistory(
  game
) {
  const store =
    readStore();

  const value =
    store[
      gameKey(
        game
      )
    ];

  return {
    baseline:
      value?.baseline
      ?? null,

    lastSnapshot:
      value?.lastSnapshot
      ?? null,

    events:
      Array.isArray(
        value?.events
      )
        ? value.events
        : [],
  };
}


export function recordChangeSnapshot(
  game,
  snapshot
) {
  const store =
    readStore();

  const key =
    gameKey(
      game
    );

  const existing =
    store[key]
    ?? {
      baseline:
        null,

      lastSnapshot:
        null,

      events:
        [],
    };

  if (!existing.lastSnapshot) {
    const value = {
      baseline:
        snapshot,

      lastSnapshot:
        snapshot,

      events:
        existing.events
        ?? [],
    };

    store[key] =
      value;

    writeStore(
      store
    );

    return {
      initialized:
        true,

      changes:
        [],

      ...value,
    };
  }

  const changes =
    compareSnapshots(
      existing.lastSnapshot,
      snapshot
    );

  const events =
    changes.length > 0
      ? [
          {
            id:
              crypto.randomUUID(),

            detectedAt:
              new Date()
                .toISOString(),

            changes,
          },

          ...(
            existing.events
            ?? []
          ),
        ]
          .slice(
            0,
            MAX_EVENTS_PER_GAME
          )
      : existing.events
        ?? [];

  const value = {
    baseline:
      existing.baseline
      ?? existing.lastSnapshot,

    lastSnapshot:
      snapshot,

    events,
  };

  store[key] =
    value;

  writeStore(
    store
  );

  window.dispatchEvent(
    new CustomEvent(
      "game-manager-change-history-changed",
      {
        detail: {
          gameKey:
            key,

          changes,
        },
      }
    )
  );

  return {
    initialized:
      false,

    changes,

    ...value,
  };
}


export function clearChangeHistory(
  game
) {
  const store =
    readStore();

  delete store[
    gameKey(
      game
    )
  ];

  writeStore(
    store
  );
}
