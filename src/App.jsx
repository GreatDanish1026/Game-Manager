import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Sidebar from "./components/Sidebar";
import GameDetails from "./components/GameDetails";
import AppErrorBoundary from "./components/AppErrorBoundary";
import UpdateNotification from "./components/UpdateNotification";

import {
  getInstalledGames,
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
} from "./services/updater";

import {
  saveLibrarySnapshot,
} from "./services/libraryInsights";


const HIDDEN_GAMES_STORAGE_KEY =
  "game-manager-hidden-games";


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
    console.error(
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
    console.error(
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


export default function App() {
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
    useState(false);


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


      const uniqueGames =
        Array.from(
          new Map(
            installedGames.map(
              (game) => [
                game.id,
                game,
              ]
            )
          ).values()
        );


      setGames(
        uniqueGames.map(
          prepareGameForUi
        )
      );


      setSelectedGame(
        null
      );
    } catch (error) {
      console.error(
        "[Game Manager] Scan failed:",
        error
      );


      setScanError(
        String(error)
      );


      setGames(
        []
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


  useEffect(
    () => {
      scanGames();
    },
    []
  );


  async function runUpdateCheck({
    manual = false,
  } = {}) {
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
        await checkForUpdates();

      const update =
        result?.available
          ? result.update
          : null;

      setAvailableUpdate(
        update
      );

      if (manual) {
        setUpdateCheckStatus({
          state:
            update
              ? "available"
              : "current",

          message:
            update
              ? `Game Manager ${update.version} is available.`
              : "You are running the latest available version.",
        });
      }
    } catch (error) {
      console.error(
        "[Updater] Check failed:",
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
      runUpdateCheck({
        manual:
          false,
      });
    },
    []
  );


  useEffect(
    () => {
      saveLibrarySnapshot(
        games,
        games.length
      );
    },
    [
      games,
    ]
  );


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
  }


  async function selectGame(
    game
  ) {
    setSelectedGame(
      game
    );


    if (
      game.pcgwLoaded &&
      game.renodxLoaded &&
      game.vortexLoaded
    ) {
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


    /*
     * All three external lookups run in parallel.
     */
    const [
      pcgwResult,
      hdrModsResult,
      vortexResult,
    ] =
      await Promise.allSettled([
        game.pcgwLoaded
          ? Promise.resolve(
              null
            )
          : getPcGamingWikiData(
              game
            ),

        game.renodxLoaded
          ? Promise.resolve(
              null
            )
          : getRenoDxModStatus(
              game
            ),

        game.vortexLoaded
          ? Promise.resolve(
              null
            )
          : getVortexSupport(
              game
            ),
      ]);


    let updatedGame =
      loadingGame;


    // ============================================================
    // PCGW
    // ============================================================

    if (!game.pcgwLoaded) {
      if (
        pcgwResult.status ===
        "fulfilled"
      ) {
        updatedGame =
          mergePcgwData(
            updatedGame,
            pcgwResult.value
          );
      } else {
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

    if (!game.renodxLoaded) {
      if (
        hdrModsResult.status ===
        "fulfilled"
      ) {
        updatedGame =
          mergeRenoDxData(
            updatedGame,
            hdrModsResult.value
          );
      } else {
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

    if (!game.vortexLoaded) {
      if (
        vortexResult.status ===
        "fulfilled"
      ) {
        console.log(
          "[Vortex Frontend] Rust returned:",
          vortexResult.value
        );


        updatedGame =
          mergeVortexData(
            updatedGame,
            vortexResult.value
          );
      } else {
        console.error(
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
        <GameDetails
          game={
            selectedGame
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
        />
      </AppErrorBoundary>


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
        />
      ) : null}


    </div>
  );
}