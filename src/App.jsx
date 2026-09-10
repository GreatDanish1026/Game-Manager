import {
  useEffect,
  useMemo,
  useRef,
  useState,
  } from "react";

import Sidebar from "./components/Sidebar";
import GameDetails from "./components/GameDetails";
import AppErrorBoundary from "./components/AppErrorBoundary";
import UpdateNotification from "./components/UpdateNotification";
import LibraryAnalysisPanel from "./components/LibraryAnalysisPanel";
import SettingsScreen from "./components/SettingsScreen";

import {
  gameMatchesLauncher,
  getInstalledGames,
  getInstalledGamesForLauncher,
  } from "./services/gameLibrary";

import {
  getPcGamingWikiData,
  } from "./services/pcgamingwiki";

import {
  getRenoDxModStatus,
  } from "./services/renodx";

import {
  getVortexSupport,
  } from "./services/vortex";

import {
  checkForUpdates,
  skipUpdateVersion,
} from "./services/updater";

import {
  saveLibrarySnapshot,
  storeGameInsight,
  getGameInsight,
  insightMatchesFilter,
} from "./services/libraryInsights";

import {
  getSettings,
} from "./services/settings";

import {
  getManualGames,
} from "./services/manualGames";

import {
  markServiceChecking,
  SERVICE_IDS,
  setServiceStatus,
} from "./services/serviceStatus";

import {
  isNetworkOnline,
  subscribeNetworkStatus,
} from "./services/networkStatus";

import {
  devLog,
  devWarn,
  error as logError,
  perf,
  warn as logWarn,
} from "./services/logging";

import {
  getAnalysisState,
  recordGameAnalysis,
} from "./services/analysisState";


const HIDDEN_GAMES_STORAGE_KEY =
  "game-manager-hidden-games";

const ANALYSIS_TIMESTAMPS_STORAGE_KEY =
  "game-manager-analysis-timestamps-v1";

function loadAnalysisTimestamps() {
  try {
    const stored =
      localStorage.getItem(
        ANALYSIS_TIMESTAMPS_STORAGE_KEY
      );

    if (!stored) {
      return {};
    }

    const parsed =
      JSON.parse(
        stored
      );

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? parsed
        : {};
  } catch (error) {
    logError(
      "[Library Analysis] Failed to load timestamps:",
      error
    );

    return {};
  }
}


function saveAnalysisTimestamps(
  timestamps
) {
  try {
    localStorage.setItem(
      ANALYSIS_TIMESTAMPS_STORAGE_KEY,
      JSON.stringify(
        timestamps
      )
    );
  } catch (error) {
    logError(
      "[Library Analysis] Failed to save timestamps:",
      error
    );
  }
}


function isRecentlyAnalyzed(
  game,
  timestamps,
  freshDays
) {
  if (
    game.pcgwLoaded &&
    game.renodxLoaded &&
    game.vortexLoaded
  ) {
    return true;
  }

  const timestamp =
    Number(
      timestamps[
        game.id
      ]
    );

  const freshMs =
    Math.max(
      1,
      Number(
        freshDays
      ) || 7
    )
    * 24
    * 60
    * 60
    * 1000;

  return Number.isFinite(
    timestamp
  ) &&
    Date.now() - timestamp <
      freshMs;
}


async function timedLookup(
  label,
  lookup
) {
  const started =
    performance.now();

  try {
    return await lookup();
  } finally {
    const elapsed =
      performance.now()
      - started;

    perf(
          "${label}",
          elapsed.toFixed(0)
        );
  }
}


function loadHiddenGameIds() {
  try {
    const stored =
      localStorage.getItem(
        HIDDEN_GAMES_STORAGE_KEY
      );

    if (!stored) {
      return [];
    }


    const parsed =
      JSON.parse(
        stored
      );


    return Array.isArray(parsed)
      ? parsed.filter(
          (id) =>
            typeof id === "string"
        )
      : [];
  } catch (error) {
    logError(
      "[Hidden Games] Failed to load:",
      error
    );

    return [];
  }
}


function saveHiddenGameIds(
  ids
) {
  try {
    localStorage.setItem(
      HIDDEN_GAMES_STORAGE_KEY,
      JSON.stringify(
        ids
      )
    );
  } catch (error) {
    logError(
      "[Hidden Games] Failed to save:",
      error
    );
  }
}


function normalizePcgwSupport(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }


  if (
    typeof value === "boolean"
  ) {
    return value;
  }


  const normalized =
    String(value)
      .trim()
      .toLowerCase();


  if (
    normalized === "" ||
    normalized === "unknown" ||
    normalized === "n/a" ||
    normalized === "na"
  ) {
    return null;
  }


  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "supported" ||
    normalized === "native"
  ) {
    return true;
  }


  if (
    normalized === "false" ||
    normalized === "no" ||
    normalized === "none" ||
    normalized === "unsupported"
  ) {
    return false;
  }


  return value;
}


function createEmptyModSource(
  pageUrl
) {
  return {
    found: false,
    available: false,

    status:
      "not_found",

    matchedName:
      null,

    category:
      null,

    notes:
      null,

    pageUrl,

    downloadUrl:
      null,
  };
}


function createEmptyVortexResult() {
  return {
    supported:
      false,

    supportType:
      "none",

    matchedGameName:
      null,

    extensionName:
      null,

    description:
      null,

    author:
      null,

    version:
      null,

    pageUrl:
      null,

    modId:
      null,

    gameId:
      null,

    matchScore:
      0,
  };
}


function prepareGameForUi(
  game
) {
  return {
    ...game,


    // ============================================================
    // PCGAMINGWIKI
    // ============================================================

    pcgwLoaded:
      false,

    pcgwLoading:
      false,

    pcgwError:
      null,

    pcgwPageName:
      null,

    pcgwPageUrl:
      null,

    // Cover art returned by PCGamingWiki.
    // GameDetails also has a Steam fallback when this is unavailable.
    coverImageUrl:
      game.coverImageUrl ??
      game.coverArtUrl ??
      game.coverUrl ??
      game.imageUrl ??
      null,

    essentialImprovementsHtml:
      null,


    // ============================================================
    // HDR MOD SUPPORT
    // ============================================================

    renodxLoaded:
      false,

    renodxLoading:
      false,

    renodxError:
      null,

    renodx: {
      available:
        false,

      preferredSource:
        "none",

      renodx:
        createEmptyModSource(
          "https://github.com/clshortfuse/renodx/wiki/Mods"
        ),

      luma:
        createEmptyModSource(
          "https://github.com/Filoppi/Luma-Framework/wiki/Mods-List"
        ),
    },


    // ============================================================
    // VORTEX
    // ============================================================

    vortexLoaded:
      false,

    vortexLoading:
      false,

    vortexError:
      null,

    vortex:
      createEmptyVortexResult(),


    // ============================================================
    // OVERVIEW
    // ============================================================

    developer:
      null,

    publisher:
      null,

    releaseDate:
      null,

    genres:
      [],


    // ============================================================
    // PCGW VIDEO
    // ============================================================

    features: {
      widescreen:
        null,

      widescreenNotes:
        null,

      multimonitor:
        null,

      multimonitorNotes:
        null,

      ultrawide:
        null,

      ultrawideNotes:
        null,

      fourK:
        null,

      fourKNotes:
        null,

      fov:
        null,

      fovNotes:
        null,

      windowed:
        null,

      windowedNotes:
        null,

      borderless:
        null,

      borderlessNotes:
        null,

      anisotropic:
        null,

      anisotropicNotes:
        null,

      antialiasing:
        null,

      antialiasingNotes:
        null,

      upscaling:
        null,

      upscalingTech:
        null,

      upscalingNotes:
        null,

      frameGeneration:
        null,

      frameGenerationTech:
        null,

      frameGenerationNotes:
        null,

      vsync:
        null,

      vsyncNotes:
        null,

      sixtyFps:
        null,

      sixtyFpsNotes:
        null,

      oneTwentyFps:
        null,

      oneTwentyFpsNotes:
        null,

      hdr:
        null,

      hdrNotes:
        null,

      rayTracing:
        null,

      rayTracingNotes:
        null,

      colorBlind:
        null,

      colorBlindNotes:
        null,

      wsgfLink:
        null,

      wsgfAwards: {
        widescreen:
          null,

        multimonitor:
          null,

        ultrawide:
          null,

        fourK:
          null,
      },
    },


    // ============================================================
    // CONTROLLERS
    // ============================================================

    controllerCompatibility: {
      xbox: {
        supported:
          null,

        models:
          null,
      },

      playstation: {
        supported:
          null,

        models:
          null,

        prompts:
          null,

        connectionModes:
          null,

        motionSensors:
          null,

        lightBar:
          null,

        dualsense: {
          adaptiveTriggers:
            null,

          adaptiveTriggerModes:
            null,

          haptics:
            null,
        },
      },

      nintendo: {
        supported:
          null,

        models:
          null,
      },

      hotplug:
        null,
    },


    // ============================================================
    // TECHNICAL
    // ============================================================

    technical: {
      engine:
        null,

      api:
        null,

      saveLocation:
        null,

      configLocation:
        null,
    },
  };
}




function prepareGameForUiWithCachedInsight(
  game
) {
  const prepared =
    prepareGameForUi(
      game
    );

  const insight =
    getGameInsight(
      game
    );

  if (!insight) {
    return prepared;
  }

  return {
    ...prepared,

    features: {
      ...(prepared.features
        ?? {}),

      hdr:
        insightMatchesFilter(
          insight,
          "hdr"
        ),

      rayTracing:
        insightMatchesFilter(
          insight,
          "ray-tracing"
        ),

      frameGeneration:
        insightMatchesFilter(
          insight,
          "frame-generation"
        ),

      ultrawide:
        insightMatchesFilter(
          insight,
          "ultrawide"
        ),

      fourK:
        insightMatchesFilter(
          insight,
          "4k"
        ),

      oneTwentyFps:
        insightMatchesFilter(
          insight,
          "120fps"
        ),

      upscaling:
        insightMatchesFilter(
          insight,
          "upscaling"
        ),
    },

    renodx: {
      ...(prepared.renodx
        ?? {}),

      renodx: {
        ...(prepared.renodx
          ?.renodx
          ?? {}),

        available:
          insightMatchesFilter(
            insight,
            "renodx"
          ),
      },

      luma: {
        ...(prepared.renodx
          ?.luma
          ?? {}),

        available:
          insightMatchesFilter(
            insight,
            "luma"
          ),
      },
    },

    vortex: {
      ...(prepared.vortex
        ?? {}),

      supported:
        insightMatchesFilter(
          insight,
          "vortex"
        ),
    },

    fluffy: {
      ...(prepared.fluffy
        ?? {}),

      supported:
        insightMatchesFilter(
          insight,
          "fluffy"
        ),
    },
  };
}

function mergePcgwData(
  game,
  data
) {
  if (!data) {
    return {
      ...game,

      pcgwLoaded:
        true,

      pcgwLoading:
        false,

      pcgwError:
        "PCGamingWiki returned no data.",
    };
  }


  if (!data.found) {
    return {
      ...game,

      pcgwLoaded:
        true,

      pcgwLoading:
        false,

      pcgwError:
        null,

      pcgwPageName:
        null,

      pcgwPageUrl:
        null,

      // Preserve any artwork supplied by the library scanner even when
      // PCGamingWiki does not find a matching page.
      coverImageUrl:
        game.coverImageUrl ??
        game.coverArtUrl ??
        game.coverUrl ??
        game.imageUrl ??
        null,

      essentialImprovementsHtml:
        null,
    };
  }


  const features = {
    widescreen:
      normalizePcgwSupport(
        data.widescreenResolution
      ),

    widescreenNotes:
      data.widescreenResolutionNotes ??
      null,


    multimonitor:
      normalizePcgwSupport(
        data.multimonitor
      ),

    multimonitorNotes:
      data.multimonitorNotes ??
      null,


    ultrawide:
      normalizePcgwSupport(
        data.ultrawidescreen
      ),

    ultrawideNotes:
      data.ultrawidescreenNotes ??
      null,


    fourK:
      normalizePcgwSupport(
        data.fourKUltraHd
      ),

    fourKNotes:
      data.fourKUltraHdNotes ??
      null,


    fov:
      normalizePcgwSupport(
        data.fov
      ),

    fovNotes:
      data.fovNotes ??
      null,


    windowed:
      normalizePcgwSupport(
        data.windowed
      ),

    windowedNotes:
      data.windowedNotes ??
      null,


    borderless:
      normalizePcgwSupport(
        data.borderlessWindowed
      ),

    borderlessNotes:
      data.borderlessWindowedNotes ??
      null,


    anisotropic:
      normalizePcgwSupport(
        data.anisotropic
      ),

    anisotropicNotes:
      data.anisotropicNotes ??
      null,


    antialiasing:
      normalizePcgwSupport(
        data.antialiasing
      ),

    antialiasingNotes:
      data.antialiasingNotes ??
      null,


    upscaling:
      normalizePcgwSupport(
        data.upscaling
      ),

    upscalingTech:
      data.upscalingTech ??
      null,

    upscalingNotes:
      data.upscalingNotes ??
      null,


    frameGeneration:
      normalizePcgwSupport(
        data.frameGeneration
      ),

    frameGenerationTech:
      data.frameGenerationTech ??
      null,

    frameGenerationNotes:
      data.frameGenerationNotes ??
      null,


    vsync:
      normalizePcgwSupport(
        data.vsync
      ),

    vsyncNotes:
      data.vsyncNotes ??
      null,


    sixtyFps:
      normalizePcgwSupport(
        data.sixtyFps
      ),

    sixtyFpsNotes:
      data.sixtyFpsNotes ??
      null,


    oneTwentyFps:
      normalizePcgwSupport(
        data.oneTwentyFps
      ),

    oneTwentyFpsNotes:
      data.oneTwentyFpsNotes ??
      null,


    hdr:
      normalizePcgwSupport(
        data.hdr
      ),

    hdrNotes:
      data.hdrNotes ??
      null,


    rayTracing:
      normalizePcgwSupport(
        data.rayTracing
      ),

    rayTracingNotes:
      data.rayTracingNotes ??
      null,


    colorBlind:
      normalizePcgwSupport(
        data.colorBlind
      ),

    colorBlindNotes:
      data.colorBlindNotes ??
      null,


    wsgfLink:
      data.wsgfLink ??
      null,

    wsgfAwards: {
      widescreen:
        data.widescreenWsgfAward ??
        null,

      multimonitor:
        data.multimonitorWsgfAward ??
        null,

      ultrawide:
        data.ultrawidescreenWsgfAward ??
        null,

      fourK:
        data.fourKUltraHdWsgfAward ??
        null,
    },
  };


  return {
    ...game,

    pcgwLoaded:
      true,

    pcgwLoading:
      false,

    pcgwError:
      null,

    pcgwPageName:
      data.pageName ??
      null,

    pcgwPageUrl:
      data.pageUrl ??
      null,

    // Restore the cover-art field that existed before the v1.0.0
    // production-readiness refactor. Prefer PCGamingWiki artwork, then
    // preserve any scanner-provided artwork already attached to the game.
    coverImageUrl:
      data.coverImageUrl ??
      game.coverImageUrl ??
      game.coverArtUrl ??
      game.coverUrl ??
      game.imageUrl ??
      null,

    essentialImprovementsHtml:
      data.essentialImprovementsHtml ??
      null,

    developer:
      data.developer ??
      null,

    publisher:
      data.publisher ??
      null,

    releaseDate:
      data.releaseDate ??
      null,

    features,

    controllerCompatibility: {
      xbox: {
        supported:
          normalizePcgwSupport(
            data.xboxControllerSupport
          ),

        models:
          data.xboxControllerModels ??
          null,
      },


      playstation: {
        supported:
          normalizePcgwSupport(
            data.playstationControllerSupport
          ),

        models:
          data.playstationControllerModels ??
          null,

        prompts:
          normalizePcgwSupport(
            data.playstationPrompts
          ),

        connectionModes:
          data.playstationConnectionModes ??
          null,

        motionSensors:
          normalizePcgwSupport(
            data.playstationMotionSensors
          ),

        lightBar:
          normalizePcgwSupport(
            data.playstationLightBar
          ),

        dualsense: {
          adaptiveTriggers:
            normalizePcgwSupport(
              data.dualsenseAdaptiveTriggers
            ),

          adaptiveTriggerModes:
            data.dualsenseAdaptiveTriggerModes ??
            null,

          haptics:
            normalizePcgwSupport(
              data.dualsenseHaptics
            ),
        },
      },


      nintendo: {
        supported:
          normalizePcgwSupport(
            data.nintendoControllerSupport
          ),

        models:
          data.nintendoControllerModels ??
          null,
      },


      hotplug:
        normalizePcgwSupport(
          data.controllerHotplug
        ),
    },


    technical: {
      engine:
        data.engine ??
        null,

      api:
        data.graphicsApi ??
        null,

      configLocation:
        data.configLocation ??
        null,

      saveLocation:
        data.saveLocation ??
        null,
    },
  };
}


function mergeRenoDxData(
  game,
  data
) {
  if (!data) {
    return {
      ...game,

      renodxLoaded:
        true,

      renodxLoading:
        false,

      renodxError:
        "HDR mod lookup returned no data.",
    };
  }


  const renodxSource = {
    found:
      data.renodx?.found ??
      false,

    available:
      data.renodx?.available ??
      false,

    status:
      data.renodx?.status ??
      "not_found",

    matchedName:
      data.renodx?.matchedName ??
      null,

    category:
      data.renodx?.category ??
      null,

    notes:
      data.renodx?.notes ??
      null,

    pageUrl:
      data.renodx?.pageUrl ??
      "https://github.com/clshortfuse/renodx/wiki/Mods",

    downloadUrl:
      data.renodx?.downloadUrl ??
      null,
  };


  const lumaSource = {
    found:
      data.luma?.found ??
      false,

    available:
      data.luma?.available ??
      false,

    status:
      data.luma?.status ??
      "not_found",

    matchedName:
      data.luma?.matchedName ??
      null,

    category:
      data.luma?.category ??
      null,

    notes:
      data.luma?.notes ??
      null,

    pageUrl:
      data.luma?.pageUrl ??
      "https://github.com/Filoppi/Luma-Framework/wiki/Mods-List",

    downloadUrl:
      data.luma?.downloadUrl ??
      null,
  };


  return {
    ...game,

    renodxLoaded:
      true,

    renodxLoading:
      false,

    renodxError:
      null,

    renodx: {
      available:
        data.available ??
        (
          renodxSource.available ||
          lumaSource.available
        ),

      preferredSource:
        data.preferredSource ??
        (
          renodxSource.available &&
          lumaSource.available
            ? "both"
            : renodxSource.available
              ? "renodx"
              : lumaSource.available
                ? "luma"
                : "none"
        ),

      renodx:
        renodxSource,

      luma:
        lumaSource,
    },
  };
}


function mergeVortexData(
  game,
  data
) {
  if (!data) {
    return {
      ...game,

      vortexLoaded:
        true,

      vortexLoading:
        false,

      vortexError:
        "Vortex lookup returned no data.",
    };
  }


  return {
    ...game,

    vortexLoaded:
      true,

    vortexLoading:
      false,

    vortexError:
      null,

    vortex: {
      supported:
        data.supported ??
        false,

      supportType:
        data.supportType ??
        "none",

      matchedGameName:
        data.matchedGameName ??
        null,

      extensionName:
        data.extensionName ??
        null,

      description:
        data.description ??
        null,

      author:
        data.author ??
        null,

      version:
        data.version ??
        null,

      pageUrl:
        data.pageUrl ??
        null,

      modId:
        data.modId ??
        null,

      gameId:
        data.gameId ??
        null,

      matchScore:
        data.matchScore ??
        0,
    },
  };
}


function errorToServiceMessage(
  error
) {
  const message =
    String(
      error
      ?? "Unknown error"
    );

  if (
    /valid release json|release json|latest\.json|updater metadata|update metadata/i.test(
      message
    )
  ) {
    return {
      status:
        "degraded",

      message:
        "GitHub is reachable, but the updater release metadata is missing or invalid.",
    };
  }

  if (
    /429|rate.?limit/i.test(
      message
    )
  ) {
    return {
      status:
        "degraded",

      message:
        "Rate limited by the service.",
    };
  }

  if (
    /timeout|timed out/i.test(
      message
    )
  ) {
    return {
      status:
        "degraded",

      message:
        "Service request timed out.",
    };
  }

  if (
    /5\d\d|server error/i.test(
      message
    )
  ) {
    return {
      status:
        "degraded",

      message:
        "Service returned a server error.",
    };
  }

  return {
    status:
      "offline",

    message,
  };
}


function markLookupSuccess(
  serviceId,
  message = "Service responded successfully."
) {
  setServiceStatus(
    serviceId,
    "online",
    message
  );
}


function markLookupFailure(
  serviceId,
  error
) {
  const result =
    errorToServiceMessage(
      error
    );

  setServiceStatus(
    serviceId,
    result.status,
    result.message
  );
}


import {
  applyLibraryOverride,
} from "./services/libraryOverrides";

export default function App() {
  const [
    networkOnline,
    setNetworkOnline,
  ] =
    useState(
      () =>
        isNetworkOnline()
    );

  const [
    games,
    setGames,
  ] =
    useState([]);


  const [
    selectedGame,
    setSelectedGame,
  ] =
    useState(null);


  const [
    search,
    setSearch,
  ] =
    useState("");


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    scanError,
    setScanError,
  ] =
    useState(null);


  const [
    hiddenGameIds,
    setHiddenGameIds,
  ] =
    useState(
      () =>
        loadHiddenGameIds()
    );


  const [
    showHiddenGames,
    setShowHiddenGames,
  ] =
    useState(
      () =>
        getSettings()
          .showHiddenOnStartup
    );

  const [
    activeView,
    setActiveView,
  ] =
    useState(
      () =>
        getSettings()
          .startupView
    );


  const [
    availableUpdate,
    setAvailableUpdate,
  ] =
    useState(null);


  const [
    updateCheckStatus,
    setUpdateCheckStatus,
  ] =
    useState({
      state:
        "idle",

      message:
        null,
    });


  const [
    libraryAnalysis,
    setLibraryAnalysis,
  ] =
    useState({
      state:
        "idle",

      total:
        0,

      completed:
        0,

      succeeded:
        0,

      failed:
        0,

      skipped:
        0,

      activeGames:
        [],

      errors:
        [],

      retryCount:
        0,

      effectiveConcurrency:
        0,

      adaptiveReduced:
        false,

      notice:
        null,
    });

  const analysisCancelRef =
    useRef(false);

  const analysisRunIdRef =
    useRef(0);


  function updateGameEverywhere(
    updatedGame
  ) {
    setGames(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            updatedGame.id
              ? updatedGame
              : item
        )
    );

    setSelectedGame(
      (current) =>
        current?.id ===
        updatedGame.id
          ? updatedGame
          : current
    );
  }


  function isTransientAnalysisError(
    error
  ) {
    const message =
      String(
        error ?? ""
      )
        .trim()
        .toLowerCase();

    if (!message) {
      return false;
    }

    return (
      /\b429\b/.test(
        message
      ) ||
      /\b408\b/.test(
        message
      ) ||
      /\b5\d\d\b/.test(
        message
      ) ||
      /rate.?limit/.test(
        message
      ) ||
      /too many requests/.test(
        message
      ) ||
      /timeout|timed out/.test(
        message
      ) ||
      /temporar/.test(
        message
      ) ||
      /service unavailable/.test(
        message
      ) ||
      /bad gateway/.test(
        message
      ) ||
      /gateway timeout/.test(
        message
      ) ||
      /network/.test(
        message
      ) ||
      /fetch failed/.test(
        message
      ) ||
      /connection (?:reset|refused|closed|aborted)/.test(
        message
      ) ||
      /econnreset|econnrefused|etimedout/.test(
        message
      )
    );
  }


  function retryDelayMs(
    retryNumber
  ) {
    const baseDelay =
      700 *
      (
        2 **
        Math.max(
          0,
          retryNumber - 1
        )
      );

    const jitter =
      Math.floor(
        Math.random() *
        450
      );

    return Math.min(
      5000,
      baseDelay + jitter
    );
  }


  async function waitForAnalysisDelay(
    milliseconds
  ) {
    let remaining =
      milliseconds;

    while (
      remaining > 0
    ) {
      if (
        analysisCancelRef.current
      ) {
        throw new Error(
          "Analysis cancelled."
        );
      }

      const slice =
        Math.min(
          100,
          remaining
        );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            slice
          )
      );

      remaining -=
        slice;
    }
  }


  async function retryBackgroundLookup(
    label,
    lookup,
    {
      maxAttempts = 3,
    } = {}
  ) {
    let lastError =
      null;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt += 1
    ) {
      if (
        analysisCancelRef.current
      ) {
        throw new Error(
          "Analysis cancelled."
        );
      }

      try {
        return await timedLookup(
          attempt === 1
            ? label
            : `${label} retry ${attempt - 1}`,
          lookup
        );
      } catch (error) {
        lastError =
          error;

        const transient =
          isTransientAnalysisError(
            error
          );

        if (
          !transient ||
          attempt >= maxAttempts
        ) {
          throw error;
        }

        const delay =
          retryDelayMs(
            attempt
          );

        setLibraryAnalysis(
          (current) => ({
            ...current,

            retryCount:
              (
                current.retryCount ??
                0
              ) + 1,
          })
        );

        devWarn(
          `[Library Analysis] ${label} transient failure. Retry ${attempt}/${maxAttempts - 1} in ${delay} ms:`,
          error
        );

        await waitForAnalysisDelay(
          delay
        );
      }
    }

    throw lastError;
  }


  async function analyzeGameInBackground(
    game
  ) {
    const analysisStarted =
      performance.now();

    if (
      !game.pcgwLoaded ||
      game.pcgwError
    ) {
      markServiceChecking(
        SERVICE_IDS.pcgw
      );
    }

    if (
      !game.renodxLoaded ||
      game.renodxError
    ) {
      markServiceChecking(
        SERVICE_IDS.renodx
      );

      markServiceChecking(
        SERVICE_IDS.luma
      );
    }

    if (
      !game.vortexLoaded ||
      game.vortexError
    ) {
      markServiceChecking(
        SERVICE_IDS.vortex
      );
    }

    const [
      pcgwResult,
      hdrModsResult,
      vortexResult,
    ] =
      await Promise.allSettled([
        game.pcgwLoaded &&
        !game.pcgwError
          ? Promise.resolve(
              null
            )
          : retryBackgroundLookup(
              `PCGamingWiki [${game.name}]`,
              () =>
                getPcGamingWikiData(
                  game
                )
            ),

        game.renodxLoaded &&
        !game.renodxError
          ? Promise.resolve(
              null
            )
          : retryBackgroundLookup(
              `RenoDX / Luma [${game.name}]`,
              () =>
                getRenoDxModStatus(
                  game
                )
            ),

        game.vortexLoaded &&
        !game.vortexError
          ? Promise.resolve(
              null
            )
          : retryBackgroundLookup(
              `Vortex [${game.name}]`,
              () =>
                getVortexSupport(
                  game
                )
            ),
      ]);

    let updatedGame = {
      ...game,

      pcgwLoading:
        false,

      renodxLoading:
        false,

      vortexLoading:
        false,
    };


    if (
      !game.pcgwLoaded ||
      game.pcgwError
    ) {
      if (
        pcgwResult.status ===
        "fulfilled"
      ) {
        markLookupSuccess(
          SERVICE_IDS.pcgw
        );

        updatedGame =
          mergePcgwData(
            updatedGame,
            pcgwResult.value
          );
      } else {
        markLookupFailure(
          SERVICE_IDS.pcgw,
          pcgwResult.reason
        );

        updatedGame = {
          ...updatedGame,

          pcgwLoaded:
            true,

          pcgwError:
            String(
              pcgwResult.reason
            ),
        };
      }
    }


    if (
      !game.renodxLoaded ||
      game.renodxError
    ) {
      if (
        hdrModsResult.status ===
        "fulfilled"
      ) {
        markLookupSuccess(
          SERVICE_IDS.renodx
        );

        markLookupSuccess(
          SERVICE_IDS.luma
        );

        updatedGame =
          mergeRenoDxData(
            updatedGame,
            hdrModsResult.value
          );
      } else {
        markLookupFailure(
          SERVICE_IDS.renodx,
          hdrModsResult.reason
        );

        markLookupFailure(
          SERVICE_IDS.luma,
          hdrModsResult.reason
        );

        updatedGame = {
          ...updatedGame,

          renodxLoaded:
            true,

          renodxError:
            String(
              hdrModsResult.reason
            ),
        };
      }
    }


    if (
      !game.vortexLoaded ||
      game.vortexError
    ) {
      if (
        vortexResult.status ===
        "fulfilled"
      ) {
        markLookupSuccess(
          SERVICE_IDS.vortex
        );

        updatedGame =
          mergeVortexData(
            updatedGame,
            vortexResult.value
          );
      } else {
        markLookupFailure(
          SERVICE_IDS.vortex,
          vortexResult.reason
        );

        updatedGame = {
          ...updatedGame,

          vortexLoaded:
            true,

          vortexError:
            String(
              vortexResult.reason
            ),
        };
      }
    }


    const failed =
      Boolean(
        updatedGame.pcgwError ||
        updatedGame.renodxError ||
        updatedGame.vortexError
      );

    updateGameEverywhere(
      updatedGame
    );

    try {
      storeGameInsight(
        updatedGame
      );
    } catch (error) {
      logError(
        "[Library Analysis] Failed to store insight:",
        error
      );
    }

    try {
      recordGameAnalysis(
        updatedGame
      );
    } catch (error) {
      logError(
        "[Library Analysis] Failed to store analysis state:",
        error
      );
    }

    perf(
          "Background analysis [${game.name}]",
          (performance.now() - analysisStarted).toFixed(0)
        );

    const transientFailure =
      failed &&
      [
        updatedGame.pcgwError,
        updatedGame.renodxError,
        updatedGame.vortexError,
      ].some(
        (error) =>
          isTransientAnalysisError(
            error
          )
      );

    return {
      updatedGame,
      failed,
      transientFailure,
    };
  }


  async function startLibraryAnalysis(
    mode = "remaining"
  ) {
    if (
      !isNetworkOnline()
    ) {
      setLibraryAnalysis(
        (current) => ({
          ...current,

          state:
            "complete",

          total:
            0,

          completed:
            0,

          succeeded:
            0,

          failed:
            0,

          activeGames:
            [],

          notice:
            "Offline mode: remote library analysis is paused until connectivity returns.",
        })
      );

      return;
    }

    if (
      libraryAnalysis.state ===
      "running" ||
      libraryAnalysis.state ===
      "cancelling"
    ) {
      return;
    }

    const timestamps =
      loadAnalysisTimestamps();

    const analysisSettings =
      getSettings();

    const queue =
      games.filter(
        (game) => {
          const state =
            getAnalysisState(
              game,
              analysisSettings
                .analysisFreshDays
            );

          if (
            mode ===
            "stale"
          ) {
            return state.status ===
              "stale";
          }

          return state.status !==
            "full";
        }
      );

    const skipped =
      games.length -
      queue.length;

    if (
      queue.length === 0
    ) {
      setLibraryAnalysis({
        state:
          "complete",

        total:
          0,

        completed:
          0,

        succeeded:
          0,

        failed:
          0,

        skipped,

        activeGames:
          [],

        errors:
          [],

        retryCount:
          0,

        effectiveConcurrency:
          0,

        adaptiveReduced:
          false,

        notice:
          null,
      });

      return;
    }

    analysisCancelRef.current =
      false;

    const runId =
      ++analysisRunIdRef.current;

    const initialConcurrency =
      Math.max(
        1,
        Math.min(
          analysisSettings
            .analysisConcurrency,
          queue.length
        )
      );

    let effectiveConcurrency =
      initialConcurrency;

    let consecutiveTransientFailures =
      0;

    setLibraryAnalysis({
      state:
        "running",

      total:
        queue.length,

      completed:
        0,

      succeeded:
        0,

      failed:
        0,

      skipped,

      activeGames:
        [],

      errors:
        [],

      retryCount:
        0,

      effectiveConcurrency:
        initialConcurrency,

      adaptiveReduced:
        false,

      notice:
        null,
    });

    let nextIndex =
      0;

    async function worker(
      workerId
    ) {
      while (
        !analysisCancelRef.current
      ) {
        if (
          workerId >=
          effectiveConcurrency
        ) {
          break;
        }

        const index =
          nextIndex++;

        if (
          index >=
          queue.length
        ) {
          break;
        }

        const game =
          queue[index];

        setLibraryAnalysis(
          (current) => {
            if (
              runId !==
              analysisRunIdRef.current
            ) {
              return current;
            }

            return {
              ...current,

              activeGames: [
                ...current.activeGames,
                {
                  id:
                    game.id,

                  name:
                    game.name,
                },
              ],
            };
          }
        );

        let failed =
          false;

        let errorMessage =
          null;

        try {
          const result =
            await analyzeGameInBackground(
              game
            );

          failed =
            result.failed;

          if (
            result.transientFailure
          ) {
            consecutiveTransientFailures +=
              1;
          } else {
            consecutiveTransientFailures =
              0;
          }

          if (
            consecutiveTransientFailures >= 2 &&
            effectiveConcurrency > 1
          ) {
            effectiveConcurrency =
              1;

            setLibraryAnalysis(
              (current) => ({
                ...current,

                effectiveConcurrency:
                  1,

                adaptiveReduced:
                  true,

                notice:
                  "Repeated transient service failures detected. Background analysis reduced to concurrency 1 for this run.",
              })
            );

            logWarn(
              "[Library Analysis] Repeated transient failures detected; reducing concurrency to 1 for the remainder of this run."
            );
          }

          if (!failed) {
            timestamps[
              game.id
            ] =
              Date.now();

            saveAnalysisTimestamps(
              timestamps
            );
          } else {
            errorMessage =
              result.transientFailure
                ? "One or more services still failed after automatic retries."
                : "One or more data sources failed.";
          }
        } catch (error) {
          failed =
            true;

          errorMessage =
            String(error);

          logError(
            `[Library Analysis] ${game.name} failed:`,
            error
          );
        }

        setLibraryAnalysis(
          (current) => {
            if (
              runId !==
              analysisRunIdRef.current
            ) {
              return current;
            }

            const errors =
              failed
                ? [
                    ...current.errors,
                    {
                      id:
                        game.id,

                      name:
                        game.name,

                      message:
                        errorMessage,
                    },
                  ].slice(
                    -8
                  )
                : current.errors;

            return {
              ...current,

              completed:
                current.completed +
                1,

              succeeded:
                current.succeeded +
                (
                  failed
                    ? 0
                    : 1
                ),

              failed:
                current.failed +
                (
                  failed
                    ? 1
                    : 0
                ),

              activeGames:
                current.activeGames
                  .filter(
                    (item) =>
                      item.id !==
                      game.id
                  ),

              errors,
            };
          }
        );

        /*
         * Small pause between jobs keeps background analysis friendly
         * to PCGamingWiki/GitHub-backed services while still feeling fast.
         */
        if (
          !analysisCancelRef.current
        ) {
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                150
              )
          );
        }
      }
    }

    const workers =
      Array.from(
        {
          length:
            initialConcurrency,
        },
        (
          _,
          workerId
        ) =>
          worker(
            workerId
          )
      );

    await Promise.all(
      workers
    );

    if (
      runId !==
      analysisRunIdRef.current
    ) {
      return;
    }

    setLibraryAnalysis(
      (current) => ({
        ...current,

        state:
          analysisCancelRef.current
            ? "cancelled"
            : "complete",

        activeGames:
          [],
      })
    );
  }


  function cancelLibraryAnalysis() {
    if (
      libraryAnalysis.state !==
      "running"
    ) {
      return;
    }

    analysisCancelRef.current =
      true;

    setLibraryAnalysis(
      (current) => ({
        ...current,

        state:
          "cancelling",
      })
    );
  }


  useEffect(
    () => {
      const refreshManualGames =
        () => {
          const manualGames =
            getManualGames().map(
              prepareGameForUiWithCachedInsight
            );

          setGames(
            (current) => [
              ...current.filter(
                (game) =>
                  game.source !== "manual"
                  && String(game.store ?? "")
                    .trim()
                    .toLowerCase() !== "manual"
              ),
              ...manualGames,
            ]
          );
        };

      window.addEventListener(
        "game-manager-manual-games-changed",
        refreshManualGames
      );

      return () => {
        window.removeEventListener(
          "game-manager-manual-games-changed",
          refreshManualGames
        );
      };
    },
    []
  );


  async function scanGames() {
    setLoading(
      true
    );

    setScanError(
      null
    );


    try {
      const installedGames =
        await getInstalledGames();

      const manualGames =
        getManualGames();


      const uniqueGames =
        Array.from(
          new Map(
            [...installedGames, ...manualGames].map(
              (game) => [
                game.id,
                game,
              ]
            )
          ).values()
        );


      setGames(
        uniqueGames.map(
          prepareGameForUiWithCachedInsight
        )
      );


      setSelectedGame(
        null
      );
    } catch (error) {
      logError(
        "[GameAtlas] Scan failed:",
        error
      );


      setScanError(
        String(error)
      );


      setGames(
        getManualGames().map(
          prepareGameForUiWithCachedInsight
        )
      );

      setSelectedGame(
        null
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function rescanLauncher(
    launcherId
  ) {
    const normalizedLauncher =
      String(
        launcherId
        ?? ""
      )
      .trim()
      .toLowerCase();

    try {
      const scannedGames =
        await getInstalledGamesForLauncher(
          normalizedLauncher
        );

      const uniqueGames =
        Array.from(
          new Map(
            scannedGames.map(
              (game) => [
                game.id,
                game,
              ]
            )
          ).values()
        );

      setGames(
        (current) => {
          const existingById =
            new Map(
              current.map(
                (game) => [
                  game.id,
                  game,
                ]
              )
            );

          const refreshed =
            uniqueGames.map(
              (game) => {
                const existing =
                  existingById.get(
                    game.id
                  );

                return existing
                  ? {
                      ...existing,
                      ...game,
                    }
                  : prepareGameForUi(
                      game
                    );
              }
            );

          const preserved =
            current.filter(
              (game) =>
                !gameMatchesLauncher(
                  game,
                  normalizedLauncher
                )
            );

          return [
            ...preserved,
            ...refreshed,
          ];
        }
      );

      setSelectedGame(
        (current) => {
          if (
            !current
            || !gameMatchesLauncher(
              current,
              normalizedLauncher
            )
          ) {
            return current;
          }

          const refreshed =
            uniqueGames.find(
              (game) =>
                game.id
                === current.id
            );

          if (!refreshed) {
            return null;
          }

          return {
            ...current,
            ...refreshed,
          };
        }
      );

      window.dispatchEvent(
        new CustomEvent(
          "gameatlas-launcher-rescan-result",
          {
            detail: {
              launcherId:
                normalizedLauncher,

              success:
                true,

              count:
                uniqueGames.length,

              message:
                `${uniqueGames.length} game${uniqueGames.length === 1 ? "" : "s"} found.`,
            },
          }
        )
      );
    } catch (error) {
      window.dispatchEvent(
        new CustomEvent(
          "gameatlas-launcher-rescan-result",
          {
            detail: {
              launcherId:
                normalizedLauncher,

              success:
                false,

              message:
                String(
                  error
                ),
            },
          }
        )
      );
    }
  }


  useEffect(
    () => {
      const handleLauncherRescan =
        (event) => {
          const launcherId =
            event.detail
              ?.launcherId;

          if (
            launcherId
          ) {
            rescanLauncher(
              launcherId
            );
          }
        };

      window.addEventListener(
        "gameatlas-rescan-launcher",
        handleLauncherRescan
      );

      return () => {
        window.removeEventListener(
          "gameatlas-rescan-launcher",
          handleLauncherRescan
        );
      };
    },
    []
  );

  useEffect(
    () => {
      const refreshOverrides =
        () => {
          setGames(
            (current) =>
              current.map(
                applyLibraryOverride
              )
          );

          setSelectedGame(
            (current) =>
              current
                ? applyLibraryOverride(
                    current
                  )
                : current
          );
        };

      window.addEventListener(
        "game-manager-library-overrides-changed",
        refreshOverrides
      );

      return () => {
        window.removeEventListener(
          "game-manager-library-overrides-changed",
          refreshOverrides
        );
      };
    },
    []
  );




  useEffect(
    () => {
      scanGames();
    },
    []
  );


  useEffect(
    () =>
      subscribeNetworkStatus(
        (online) => {
          setNetworkOnline(
            online
          );

          if (!online) {
            [
              SERVICE_IDS.pcgw,
              SERVICE_IDS.renodx,
              SERVICE_IDS.luma,
              SERVICE_IDS.vortex,
              SERVICE_IDS.github,
            ].forEach(
              (serviceId) =>
                setServiceStatus(
                  serviceId,
                  "offline",
                  "Device appears to be offline. Cached and local data remain available."
                )
            );
          }
        }
      ),
    []
  );


  async function runUpdateCheck({
    manual = false,
  } = {}) {
    if (
      !isNetworkOnline()
    ) {
      if (manual) {
        setUpdateCheckStatus({
          state:
            "offline",

          message:
            "Offline — update checks require an internet connection.",
        });
      }

      setServiceStatus(
        SERVICE_IDS.github,
        "offline",
        "Device appears to be offline."
      );

      return;
    }

    markServiceChecking(
      SERVICE_IDS.github
    );

    if (manual) {
      setUpdateCheckStatus({
        state:
          "checking",

        message:
          null,
      });
    }

    try {
      const result =
        await checkForUpdates({
          includeSkipped:
            manual,
        });

      const update =
        result?.available
          ? result.update
          : null;

      setAvailableUpdate(
        update
      );

      markLookupSuccess(
        SERVICE_IDS.github,
        update
          ? `Update ${update.version} is available.`
          : "Update service responded successfully."
      );

      if (manual) {
        setUpdateCheckStatus({
          state:
            update
              ? "available"
              : "current",

          message:
            update
              ? result?.skipped
                ? `GameAtlas ${update.version} is available. You previously skipped this version.`
                : `GameAtlas ${update.version} is available.`
              : result?.skipped
                ? `GameAtlas ${result.skippedVersion} is available but is currently skipped.`
                : "You are running the latest available version.",
        });
      }
    } catch (error) {
      logError(
        "[Updater] Check failed:",
        error
      );

      markLookupFailure(
        SERVICE_IDS.github,
        error
      );

      /*
       * Automatic update-check failures are intentionally silent.
       * Offline users should not receive a warning every time the
       * application starts. Manual checks surface the error where
       * the user explicitly requested the operation.
       */
      if (manual) {
        setUpdateCheckStatus({
          state:
            "error",

          message:
            String(error),
        });
      }
    }
  }


  useEffect(
    () => {
      if (
        getSettings()
          .automaticUpdateChecks
      ) {
        runUpdateCheck({
          manual:
            false,
        });
      }
    },
    []
  );
  function skipAvailableUpdate() {
    const version =
      availableUpdate
        ?.version;

    if (version) {
      skipUpdateVersion(
        version
      );
    }

    setAvailableUpdate(
      null
    );

    setUpdateCheckStatus({
      state:
        "skipped",

      message:
        version
          ? `GameAtlas ${version} will be skipped during automatic update checks. Manual checks can still show it.`
          : "Update skipped.",
    });
  }


function hideGame(
    game
  ) {
    setHiddenGameIds(
      (current) => {
        const next =
          current.includes(
            game.id
          )
            ? current
            : [
                ...current,
                game.id,
              ];


        saveHiddenGameIds(
          next
        );


        return next;
      }
    );


    if (
      selectedGame?.id ===
      game.id
    ) {
      setSelectedGame(
        null
      );
    }
  }


  function restoreGame(
    game
  ) {
    setHiddenGameIds(
      (current) => {
        const next =
          current.filter(
            (id) =>
              id !== game.id
          );


        saveHiddenGameIds(
          next
        );


        return next;
      }
    );
  }


  function restoreAllHiddenGames() {
    setHiddenGameIds(
      []
    );

    saveHiddenGameIds(
      []
    );
  }


  function showDashboard() {
    setSelectedGame(
      null
    );

    setShowHiddenGames(
      false
    );

    setActiveView(
      "library"
    );
  }


  function showSettings() {
    setSelectedGame(
      null
    );

    setShowHiddenGames(
      false
    );

    setActiveView(
      "settings"
    );
  }


  async function selectGame(
    game
  ) {
    const analysisStarted =
      performance.now();

    setSelectedGame(
      game
    );


    if (
      game.pcgwLoaded &&
      !game.pcgwError &&
      game.renodxLoaded &&
      !game.renodxError &&
      game.vortexLoaded &&
      !game.vortexError
    ) {
      perf(
          "Selected game cache hit",
          (performance.now() - analysisStarted).toFixed(0)
        );

      return;
    }


    if (
      !isNetworkOnline()
    ) {
      const offlineGame = {
        ...game,

        pcgwLoading:
          false,

        renodxLoading:
          false,

        vortexLoading:
          false,
      };

      setSelectedGame(
        offlineGame
      );

      setGames(
        (current) =>
          current.map(
            (item) =>
              item.id === game.id
                ? offlineGame
                : item
          )
      );

      return;
    }


    const loadingGame = {
      ...game,

      pcgwLoading:
        !game.pcgwLoaded,

      renodxLoading:
        !game.renodxLoaded,

      vortexLoading:
        !game.vortexLoaded,
    };


    setSelectedGame(
      loadingGame
    );


    setGames(
      (current) =>
        current.map(
          (item) =>
            item.id === game.id
              ? loadingGame
              : item
        )
    );


    if (
      !game.pcgwLoaded ||
      game.pcgwError
    ) {
      markServiceChecking(
        SERVICE_IDS.pcgw
      );
    }

    if (
      !game.renodxLoaded ||
      game.renodxError
    ) {
      markServiceChecking(
        SERVICE_IDS.renodx
      );

      markServiceChecking(
        SERVICE_IDS.luma
      );
    }

    if (
      !game.vortexLoaded ||
      game.vortexError
    ) {
      markServiceChecking(
        SERVICE_IDS.vortex
      );
    }

    /*
     * All three external lookups run in parallel.
     */
    const [
      pcgwResult,
      hdrModsResult,
      vortexResult,
    ] =
      await Promise.allSettled([
        game.pcgwLoaded &&
        !game.pcgwError
          ? Promise.resolve(
              null
            )
          : timedLookup(
              "PCGamingWiki",
              () =>
                getPcGamingWikiData(
                  game
                )
            ),

        game.renodxLoaded &&
        !game.renodxError
          ? Promise.resolve(
              null
            )
          : timedLookup(
              "RenoDX / Luma",
              () =>
                getRenoDxModStatus(
                  game
                )
            ),

        game.vortexLoaded &&
        !game.vortexError
          ? Promise.resolve(
              null
            )
          : timedLookup(
              "Vortex",
              () =>
                getVortexSupport(
                  game
                )
            ),
      ]);


    let updatedGame =
      loadingGame;


    // ============================================================
    // PCGW
    // ============================================================

    if (
      !game.pcgwLoaded ||
      game.pcgwError
    ) {
      if (
        pcgwResult.status ===
        "fulfilled"
      ) {
        markLookupSuccess(
          SERVICE_IDS.pcgw
        );

        updatedGame =
          mergePcgwData(
            updatedGame,
            pcgwResult.value
          );
      } else {
        markLookupFailure(
          SERVICE_IDS.pcgw,
          pcgwResult.reason
        );

        updatedGame = {
          ...updatedGame,

          pcgwLoaded:
            true,

          pcgwLoading:
            false,

          pcgwError:
            String(
              pcgwResult.reason
            ),
        };
      }
    }


    // ============================================================
    // RENODX / LUMA
    // ============================================================

    if (
      !game.renodxLoaded ||
      game.renodxError
    ) {
      if (
        hdrModsResult.status ===
        "fulfilled"
      ) {
        markLookupSuccess(
          SERVICE_IDS.renodx
        );

        markLookupSuccess(
          SERVICE_IDS.luma
        );

        updatedGame =
          mergeRenoDxData(
            updatedGame,
            hdrModsResult.value
          );
      } else {
        markLookupFailure(
          SERVICE_IDS.renodx,
          hdrModsResult.reason
        );

        markLookupFailure(
          SERVICE_IDS.luma,
          hdrModsResult.reason
        );

        updatedGame = {
          ...updatedGame,

          renodxLoaded:
            true,

          renodxLoading:
            false,

          renodxError:
            String(
              hdrModsResult.reason
            ),
        };
      }
    }


    // ============================================================
    // VORTEX
    // ============================================================

    if (
      !game.vortexLoaded ||
      game.vortexError
    ) {
      if (
        vortexResult.status ===
        "fulfilled"
      ) {
        markLookupSuccess(
          SERVICE_IDS.vortex
        );

        devLog(
          "[Vortex Frontend] Rust returned:",
          vortexResult.value
        );


        updatedGame =
          mergeVortexData(
            updatedGame,
            vortexResult.value
          );
      } else {
        markLookupFailure(
          SERVICE_IDS.vortex,
          vortexResult.reason
        );

        logError(
          "[Vortex] Lookup failed:",
          vortexResult.reason
        );


        updatedGame = {
          ...updatedGame,

          vortexLoaded:
            true,

          vortexLoading:
            false,

          vortexError:
            String(
              vortexResult.reason
            ),
        };
      }
    }


    perf(
          "Selected game analysis",
          (performance.now() - analysisStarted).toFixed(0)
        );

    try {
      storeGameInsight(
        updatedGame
      );
    } catch (error) {
      logError(
        "[Library Analysis] Failed to store selected-game insight:",
        error
      );
    }

    try {
      recordGameAnalysis(
        updatedGame
      );
    } catch (error) {
      logError(
        "[Library Analysis] Failed to store selected-game analysis state:",
        error
      );
    }

    if (
      !updatedGame.pcgwError &&
      !updatedGame.renodxError &&
      !updatedGame.vortexError
    ) {
      const timestamps =
        loadAnalysisTimestamps();

      timestamps[
        updatedGame.id
      ] =
        Date.now();

      saveAnalysisTimestamps(
        timestamps
      );
    }


    setGames(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            updatedGame.id
              ? updatedGame
              : item
        )
    );


    setSelectedGame(
      (current) =>
        current?.id ===
        updatedGame.id
          ? updatedGame
          : current
    );
  }


  const hiddenInstalledCount =
    useMemo(
      () =>
        games.filter(
          (game) =>
            hiddenGameIds.includes(
              game.id
            )
        ).length,

      [
        games,
        hiddenGameIds,
      ]
    );


  const visibleInstalledCount =
    games.length
      - hiddenInstalledCount;


  const filteredGames =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();


        return games.filter(
          (game) => {
            const hidden =
              hiddenGameIds.includes(
                game.id
              );


            if (
              showHiddenGames
                ? !hidden
                : hidden
            ) {
              return false;
            }


            if (!query) {
              return true;
            }


            return (
              game.name
                ?.toLowerCase()
                .includes(
                  query
                )
              ||
              game.store
                ?.toLowerCase()
                .includes(
                  query
                )
            );
          }
        );
      },

      [
        games,
        search,
        hiddenGameIds,
        showHiddenGames,
      ]
    );


  return (
    <div
      className="
        flex
        h-screen
        overflow-hidden
        bg-[#0b0f17]
        text-white
      "
    >
      <AppErrorBoundary>
      <Sidebar
        games={
          filteredGames
        }

        totalGames={
          games.length
        }

        visibleGameCount={
          visibleInstalledCount
        }

        hiddenGameCount={
          hiddenInstalledCount
        }

        selectedGame={
          selectedGame
        }

        onSelectGame={
          selectGame
        }

        onShowDashboard={
          showDashboard
        }

        onShowSettings={
          showSettings
        }

        settingsActive={
          activeView ===
          "settings"
        }

        search={
          search
        }

        onSearchChange={
          setSearch
        }

        loading={
          loading
        }

        scanError={
          scanError
        }

        onRescan={
          scanGames
        }

        showHiddenGames={
          showHiddenGames
        }

        onShowHiddenGamesChange={
          setShowHiddenGames
        }

        onHideGame={
          hideGame
        }

        onRestoreGame={
          restoreGame
        }

        onRestoreAllHiddenGames={
          restoreAllHiddenGames
        }
      />


      </AppErrorBoundary>


      <AppErrorBoundary>
        {activeView ===
        "settings" ? (
          <SettingsScreen
            onCheckForUpdates={
              () =>
                runUpdateCheck({
                  manual:
                    true,
                })
            }
            updateCheckStatus={
              updateCheckStatus
            }

            onSelectGame={
              selectGame
            }
          />
        ) : (
          <GameDetails
            game={
              selectedGame
            }
onAnalyzeRemaining={
              () =>
                startLibraryAnalysis(
                  "remaining"
                )
            }
            onRefreshStale={
              () =>
                startLibraryAnalysis(
                  "stale"
                )
            }
            libraryAnalysis={
              libraryAnalysis
            }
            onCheckForUpdates={
              () =>
                runUpdateCheck({
                  manual:
                    true,
                })
            }
            updateCheckStatus={
              updateCheckStatus
            }

            onSelectGame={
              selectGame
            }

            networkOnline={
              networkOnline
            }

            onRetryRemoteData={
              selectedGame
                ? () =>
                    selectGame(
                      selectedGame
                    )
                : null
            }
        libraryGames={
          games
        }
        onSelectLibraryGame={
          selectGame
        }/>
        )}
      </AppErrorBoundary>


      <LibraryAnalysisPanel
        analysis={
          libraryAnalysis
        }
        gameCount={
          games.length
        }
        onStart={
          startLibraryAnalysis
        }
        onCancel={
          cancelLibraryAnalysis
        }
      />


      {availableUpdate ? (
        <UpdateNotification
          update={
            availableUpdate
          }
          onDismiss={
            () =>
              setAvailableUpdate(
                null
              )
          }
          onSkip={
            skipAvailableUpdate
          }
        />
      ) : null}


    </div>
  );
}