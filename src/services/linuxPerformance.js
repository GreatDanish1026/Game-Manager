import {
  invoke,
} from "@tauri-apps/api/core";


const STORAGE_KEY =
  "gameatlas-linux-performance-v1";


function gameKey(game) {
  if (game?.id) {
    return String(game.id);
  }

  const store =
    String(game?.store ?? "unknown")
      .trim()
      .toLowerCase();

  const launcherId =
    String(game?.launcherId ?? "")
      .trim();

  if (launcherId) {
    return `${store}:${launcherId}`;
  }

  return `${store}:${String(game?.name ?? "unknown-game")
    .trim()
    .toLowerCase()}`;
}


export function defaultLinuxPerformanceSettings() {
  return {
    mangoHudEnabled: false,
    mangoHudFpsOnly: false,
    gameModeEnabled: false,
    gamescopeEnabled: false,
    gamescopeFullscreen: true,
    hdrEnabled: false,
    waylandEnabled: false,
    fpsLimit: 0,
    fpsLimitMethod: "late",
    inputWidth: 0,
    inputHeight: 0,
    outputWidth: 0,
    outputHeight: 0,
    scalingMode: "none",
  };
}


function positiveInt(value) {
  const parsed =
    Number.parseInt(
      String(value ?? "0"),
      10
    );

  return Number.isFinite(parsed)
    && parsed >= 0
      ? parsed
      : 0;
}


function normalizeSettings(value) {
  const scalingMode =
    [
      "none",
      "fsr",
      "nis",
      "integer",
      "stretch",
    ].includes(value?.scalingMode)
      ? value.scalingMode
      : "none";

  return {
    mangoHudEnabled:
      Boolean(value?.mangoHudEnabled),

    mangoHudFpsOnly:
      Boolean(value?.mangoHudFpsOnly),

    gameModeEnabled:
      Boolean(value?.gameModeEnabled),

    gamescopeEnabled:
      Boolean(value?.gamescopeEnabled),

    gamescopeFullscreen:
      value?.gamescopeFullscreen !== false,

    hdrEnabled:
      Boolean(value?.hdrEnabled),

    waylandEnabled:
      Boolean(value?.waylandEnabled),

    fpsLimit:
      positiveInt(value?.fpsLimit),

    fpsLimitMethod:
      value?.fpsLimitMethod === "early"
        ? "early"
        : "late",

    inputWidth:
      positiveInt(value?.inputWidth),

    inputHeight:
      positiveInt(value?.inputHeight),

    outputWidth:
      positiveInt(value?.outputWidth),

    outputHeight:
      positiveInt(value?.outputHeight),

    scalingMode,
  };
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
      JSON.parse(raw);

    return parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    return {};
  }
}


function writeStore(value) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(value)
  );
}


export function getLinuxPerformanceSettings(game) {
  return normalizeSettings(
    readStore()[gameKey(game)]
  );
}


export function saveLinuxPerformanceSettings(
  game,
  settings
) {
  const store =
    readStore();

  const normalized =
    normalizeSettings(settings);

  store[gameKey(game)] =
    normalized;

  writeStore(store);

  return normalized;
}


export function resetLinuxPerformanceSettings(game) {
  const store =
    readStore();

  delete store[gameKey(game)];

  writeStore(store);

  return defaultLinuxPerformanceSettings();
}


export async function getLinuxPerformanceCapabilities() {
  return invoke(
    "get_linux_performance_capabilities"
  );
}


function addResolution(
  args,
  widthFlag,
  heightFlag,
  width,
  height
) {
  if (width > 0) {
    args.push(
      widthFlag,
      String(width)
    );
  }

  if (height > 0) {
    args.push(
      heightFlag,
      String(height)
    );
  }
}


export function buildLinuxLaunchOptions(settings) {
  const value =
    normalizeSettings(settings);

  const prefix = [];
  const command = [];
  const notes = [];

  /*
   * HDR:
   * - DXVK_HDR exposes HDR to DXVK titles.
   * - PROTON_ENABLE_HDR is used by Proton builds that support the toggle.
   * - Gamescope additionally receives --hdr-enabled when it is the wrapper.
   *
   * We intentionally do not force ENABLE_HDR_WSI here. Modern Mesa/KDE setups
   * often do not require it, and forcing it globally can create unnecessary
   * compatibility issues. It can be added later as an advanced compatibility
   * option if testing shows a need.
   */
  if (value.hdrEnabled) {
    prefix.push(
      "DXVK_HDR=1",
      "PROTON_ENABLE_HDR=1"
    );
  }

  /*
   * Wayland:
   * PROTON_ENABLE_WAYLAND is supported by Proton variants that ship the
   * Wine-Wayland driver (for example GE/Cachy-derived builds). Valve Proton
   * builds may ignore it when winewayland.drv is not present.
   */
  if (value.waylandEnabled) {
    prefix.push(
      "PROTON_ENABLE_WAYLAND=1"
    );

    notes.push(
      "Wayland mode requires a Proton build with Wine-Wayland support; unsupported runtimes may ignore this setting."
    );
  }

  if (value.mangoHudEnabled) {
    prefix.push(
      "MANGOHUD=1"
    );

    const config = [
      "output_folder=${XDG_DATA_HOME:-$HOME/.local/share}/com.greatdanish.gamemanager/performance-captures",
      "log_interval=0",
      "control=mangohud-%p",
      "toggle_logging=Shift_L+F2",
    ];

    if (
      !value.gamescopeEnabled
      && value.fpsLimit > 0
    ) {
      config.push(
        `fps_limit=${value.fpsLimit}`
      );

      config.push(
        `fps_limit_method=${value.fpsLimitMethod}`
      );
    }

    if (value.mangoHudFpsOnly) {
      config.push(
        "fps_only"
      );
    }

    if (config.length > 0) {
      prefix.push(
        `MANGOHUD_CONFIG=${config.join(",")}`
      );
    }
  } else if (
    value.fpsLimit > 0
    && !value.gamescopeEnabled
  ) {
    notes.push(
      "The FPS limit needs MangoHud or Gamescope enabled."
    );
  }

  if (
    value.mangoHudEnabled
    && !value.gamescopeEnabled
  ) {
    command.push(
      "mangohud"
    );
  }

  if (value.gamescopeEnabled) {
    command.push(
      "gamescope"
    );

    if (value.gamescopeFullscreen) {
      command.push(
        "-f"
      );
    }

    if (value.mangoHudEnabled) {
      command.push(
        "--mangoapp"
      );
    }

    if (value.hdrEnabled) {
      command.push(
        "--hdr-enabled"
      );
    }

    if (value.fpsLimit > 0) {
      command.push(
        "-r",
        String(value.fpsLimit)
      );
    }

    addResolution(
      command,
      "-w",
      "-h",
      value.inputWidth,
      value.inputHeight
    );

    addResolution(
      command,
      "-W",
      "-H",
      value.outputWidth,
      value.outputHeight
    );

    if (
      value.scalingMode === "fsr"
      || value.scalingMode === "nis"
    ) {
      command.push(
        "-F",
        value.scalingMode
      );
    } else if (
      value.scalingMode === "integer"
      || value.scalingMode === "stretch"
    ) {
      command.push(
        "-S",
        value.scalingMode
      );
    }

    command.push(
      "--"
    );
  } else if (value.hdrEnabled) {
    notes.push(
      "HDR without Gamescope depends on the desktop compositor, display, driver, and Proton/Wine runtime being HDR-capable."
    );
  }

  if (value.gameModeEnabled) {
    command.push(
      "gamemoderun"
    );
  }

  command.push(
    "%command%"
  );

  return {
    launchOptions:
      [
        ...prefix,
        ...command,
      ].join(" "),

    notes,
  };
}
