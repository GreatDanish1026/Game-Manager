import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Sidebar from "./components/Sidebar";
import GameDetails from "./components/GameDetails";

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
  checkForUpdates,
} from "./services/updater";


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
      JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (id) =>
        typeof id === "string"
    );
  } catch (error) {
    console.error(
      "[Hidden Games] Failed to load:",
      error
    );

    return [];
  }
}


function saveHiddenGameIds(ids) {
  try {
    localStorage.setItem(
      HIDDEN_GAMES_STORAGE_KEY,
      JSON.stringify(ids)
    );
  } catch (error) {
    console.error(
      "[Hidden Games] Failed to save:",
      error
    );
  }
}


function normalizePcgwSupport(value) {
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


function prepareGameForUi(game) {
  return {
    ...game,

    pcgwLoaded: false,
    pcgwLoading: false,
    pcgwError: null,

    pcgwPageName: null,
    pcgwPageUrl: null,

    renodxLoaded: false,
    renodxLoading: false,
    renodxError: null,

    renodx: {
      available: false,
      status: null,
      matchedName: null,
      category: null,
      notes: null,
      pageUrl: null,
    },

    developer: null,
    publisher: null,
    releaseDate: null,

    genres: [],

    description:
      "PCGamingWiki information has not been loaded yet.",

    features: {
      hdr: null,
      ultrawide: null,
      controller: null,
      rayTracing: null,
      frameGeneration: null,
      upscaling: null,
      dlss: null,
    },

    controllerCompatibility: {
      xbox: {
        supported: null,
        models: null,
      },

      playstation: {
        supported: null,
        models: null,
        prompts: null,
        connectionModes: null,
        motionSensors: null,
        lightBar: null,

        dualsense: {
          adaptiveTriggers: null,
          adaptiveTriggerModes: null,
          haptics: null,
        },
      },

      nintendo: {
        supported: null,
        models: null,
      },

      hotplug: null,
    },

    technical: {
      engine: null,
      api: null,
      saveLocation: null,
      configLocation: null,
    },
  };
}


function mergePcgwData(
  game,
  data
) {
  console.log(
    "[PCGW MERGE] Raw data:",
    data
  );

  if (!data) {
    return {
      ...game,

      pcgwLoaded: true,
      pcgwLoading: false,

      pcgwError:
        "PCGamingWiki returned no data.",
    };
  }

  if (!data.found) {
    return {
      ...game,

      pcgwLoaded: true,
      pcgwLoading: false,
      pcgwError: null,

      pcgwPageName: null,
      pcgwPageUrl: null,

      description:
        "No PCGamingWiki information was found for this game.",
    };
  }

  const mergedFeatures = {
    ...game.features,

    hdr:
      normalizePcgwSupport(
        data.hdr
      ),

    ultrawide:
      normalizePcgwSupport(
        data.ultrawide
      ),

    controller:
      normalizePcgwSupport(
        data.controllerSupport
      ),

    rayTracing:
      normalizePcgwSupport(
        data.rayTracing
      ),

    frameGeneration:
      normalizePcgwSupport(
        data.frameGeneration
      ),

    upscaling:
      normalizePcgwSupport(
        data.upscaling
      ),

    dlss:
      game.features?.dlss ??
      null,
  };


  const mergedControllerCompatibility = {
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
  };


  const mergedGame = {
    ...game,

    pcgwLoaded: true,
    pcgwLoading: false,
    pcgwError: null,

    pcgwPageName:
      data.pageName ??
      null,

    pcgwPageUrl:
      data.pageUrl ??
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

    description:
      "PCGamingWiki information loaded.",

    features:
      mergedFeatures,

    controllerCompatibility:
      mergedControllerCompatibility,

    technical: {
      ...game.technical,

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


  console.log(
    "[PCGW MERGE] Final merged game:",
    mergedGame
  );

  return mergedGame;
}


function mergeRenoDxData(
  game,
  data
) {
  if (!data) {
    return {
      ...game,

      renodxLoaded: true,
      renodxLoading: false,

      renodxError:
        "RenoDX returned no data.",
    };
  }

  return {
    ...game,

    renodxLoaded: true,
    renodxLoading: false,
    renodxError: null,

    renodx: {
      available:
        data.available ??
        false,

      status:
        data.status ??
        null,

      matchedName:
        data.matchedName ??
        null,

      category:
        data.category ??
        null,

      notes:
        data.notes ??
        null,

      pageUrl:
        data.pageUrl ??
        null,
    },
  };
}


export default function App() {
  const [
    games,
    setGames,
  ] = useState([]);

  const [
    selectedGame,
    setSelectedGame,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    scanError,
    setScanError,
  ] = useState(null);

  const [
    hiddenGameIds,
    setHiddenGameIds,
  ] = useState(
    () =>
      loadHiddenGameIds()
  );

  const [
    showHiddenGames,
    setShowHiddenGames,
  ] = useState(false);

  const [
    availableUpdate,
    setAvailableUpdate,
  ] = useState(null);

  const [
    updateCheckError,
    setUpdateCheckError,
  ] = useState(null);


  async function scanGames() {
    console.log(
      "[Game Manager] Calling Rust game scanner..."
    );

    setLoading(true);
    setScanError(null);

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

      if (
        installedGames.length !==
        uniqueGames.length
      ) {
        console.warn(
          "[Game Manager] Duplicate games removed:",
          installedGames.length -
            uniqueGames.length
        );
      }

      const preparedGames =
        uniqueGames.map(
          prepareGameForUi
        );

      setGames(
        preparedGames
      );

      setSelectedGame(
        null
      );
    } catch (error) {
      console.error(
        "[Game Manager] Game scan failed:",
        error
      );

      setScanError(
        String(error)
      );

      setGames([]);
      setSelectedGame(null);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    scanGames();
  }, []);


  /*
   * Check for a newer Game Manager version
   * when the application starts.
   */
  useEffect(() => {
    async function checkVersion() {
      console.log(
        "[Updater] Starting automatic update check..."
      );

      setUpdateCheckError(
        null
      );

      try {
        const result =
          await checkForUpdates();

        console.log(
          "[Updater] Update check result:",
          result
        );

        if (
          result?.available &&
          result?.update
        ) {
          console.log(
            "[Updater] Update available:",
            result.update.version
          );

          setAvailableUpdate(
            result.update
          );
        } else {
          console.log(
            "[Updater] Game Manager is up to date."
          );

          setAvailableUpdate(
            null
          );
        }
      } catch (error) {
        console.error(
          "[Updater] Automatic update check failed:",
          error
        );

        setUpdateCheckError(
          String(error)
        );
      }
    }

    checkVersion();
  }, []);


  function hideGame(game) {
    setHiddenGameIds(
      (current) => {
        if (
          current.includes(
            game.id
          )
        ) {
          return current;
        }

        const next = [
          ...current,
          game.id,
        ];

        saveHiddenGameIds(
          next
        );

        return next;
      }
    );

    setSelectedGame(
      (current) =>
        current?.id === game.id
          ? null
          : current
    );
  }


  function restoreGame(game) {
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
    saveHiddenGameIds([]);

    setHiddenGameIds([]);
  }


  async function selectGame(game) {
    console.log(
      "[Game Manager] Selected game:",
      game
    );

    setSelectedGame(
      game
    );

    if (
      game.pcgwLoaded &&
      game.renodxLoaded
    ) {
      return;
    }

    const loadingGame = {
      ...game,

      pcgwLoading:
        !game.pcgwLoaded,

      renodxLoading:
        !game.renodxLoaded,
    };

    setGames(
      (currentGames) =>
        currentGames.map(
          (currentGame) =>
            currentGame.id ===
            loadingGame.id
              ? loadingGame
              : currentGame
        )
    );

    setSelectedGame(
      loadingGame
    );


    const pcgwPromise =
      game.pcgwLoaded
        ? Promise.resolve(null)
        : getPcGamingWikiData(
            game
          );


    const renodxPromise =
      game.renodxLoaded
        ? Promise.resolve(null)
        : getRenoDxModStatus(
            game
          );


    const [
      pcgwResult,
      renodxResult,
    ] =
      await Promise.allSettled([
        pcgwPromise,
        renodxPromise,
      ]);


    let updatedGame =
      loadingGame;


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
        console.error(
          "[PCGW] Lookup failed:",
          pcgwResult.reason
        );

        updatedGame = {
          ...updatedGame,

          pcgwLoaded: true,
          pcgwLoading: false,

          pcgwError:
            String(
              pcgwResult.reason
            ),
        };
      }
    }


    if (!game.renodxLoaded) {
      if (
        renodxResult.status ===
        "fulfilled"
      ) {
        updatedGame =
          mergeRenoDxData(
            updatedGame,
            renodxResult.value
          );
      } else {
        console.error(
          "[RenoDX] Lookup failed:",
          renodxResult.reason
        );

        updatedGame = {
          ...updatedGame,

          renodxLoaded: true,
          renodxLoading: false,

          renodxError:
            String(
              renodxResult.reason
            ),
        };
      }
    }


    setGames(
      (currentGames) =>
        currentGames.map(
          (currentGame) =>
            currentGame.id ===
            updatedGame.id
              ? updatedGame
              : currentGame
        )
    );


    setSelectedGame(
      (currentSelected) => {
        if (!currentSelected) {
          return currentSelected;
        }

        if (
          currentSelected.id !==
          updatedGame.id
        ) {
          return currentSelected;
        }

        return updatedGame;
      }
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
    games.length -
    hiddenInstalledCount;


  const filteredGames =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return games.filter(
          (game) => {
            const isHidden =
              hiddenGameIds.includes(
                game.id
              );

            if (showHiddenGames) {
              if (!isHidden) {
                return false;
              }
            } else if (isHidden) {
              return false;
            }

            if (!query) {
              return true;
            }

            const name =
              game.name
                ?.toLowerCase() ??
              "";

            const store =
              game.store
                ?.toLowerCase() ??
              "";

            return (
              name.includes(query) ||
              store.includes(query)
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
    <div className="flex h-screen overflow-hidden bg-[#0b0f17] text-white">
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

      <GameDetails
        game={
          selectedGame
        }
      />


      {availableUpdate ? (
        <div
          className="
            fixed
            bottom-5
            right-5
            z-50
            w-[380px]
            rounded-xl
            border
            border-cyan-500/30
            bg-[#121923]
            p-4
            shadow-2xl
          "
        >
          <div
            className="
              text-sm
              font-semibold
              text-white
            "
          >
            Update Available
          </div>

          <div
            className="
              mt-1
              text-sm
              text-white/70
            "
          >
            Game Manager{" "}
            <span
              className="
                font-semibold
                text-cyan-300
              "
            >
              {availableUpdate.version}
            </span>{" "}
            is available.
          </div>


          {availableUpdate.body ? (
            <div
              className="
                mt-3
                max-h-28
                overflow-y-auto
                whitespace-pre-wrap
                text-xs
                leading-relaxed
                text-white/45
              "
            >
              {availableUpdate.body}
            </div>
          ) : null}
        </div>
      ) : null}


      {updateCheckError ? (
        <div
          className="
            fixed
            bottom-5
            right-5
            z-40
            hidden
          "
        >
          {/*
            Intentionally hidden for now.

            The error is logged to the console,
            but we don't want a failed network
            update check to interrupt normal use
            of Game Manager.
          */}
          {updateCheckError}
        </div>
      ) : null}
    </div>
  );
}