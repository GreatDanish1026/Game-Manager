import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Sidebar from "./components/Sidebar";
import GameDetails from "./components/GameDetails";

import {
  checkForUpdates,
} from "./services/updater";

import {
  getInstalledGames,
} from "./services/gameLibrary";

import {
  getPcGamingWikiData,
} from "./services/pcgamingwiki";

import {
  getRenoDxModStatus,
} from "./services/renodx";

function prepareGameForUi(game) {
  return {
    ...game,

    // ---------------------------------------------------------
    // PCGamingWiki state
    // ---------------------------------------------------------

    pcgwLoaded: false,
    pcgwLoading: false,
    pcgwError: null,

    pcgwPageName: null,
    pcgwPageUrl: null,

    // ---------------------------------------------------------
    // RenoDX state
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // General game information
    // ---------------------------------------------------------

    developer: null,
    publisher: null,
    releaseDate: null,

    genres: [],

    description:
      "PCGamingWiki information has not been loaded yet.",

    // ---------------------------------------------------------
    // PC feature information
    // ---------------------------------------------------------

    features: {
      hdr: null,
      ultrawide: null,
      controller: null,
      rayTracing: null,
      frameGeneration: null,
      upscaling: null,
      dlss: null,
    },

    // ---------------------------------------------------------
    // Technical information
    // ---------------------------------------------------------

    technical: {
      engine: null,
      api: null,
      saveLocation: null,
      configLocation: null,
    },
  };
}

function normalizePcgwSupport(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  if (
    normalized === "true" ||
    normalized === "native" ||
    normalized === "yes"
  ) {
    return true;
  }

  if (
    normalized === "false" ||
    normalized === "none" ||
    normalized === "no"
  ) {
    return false;
  }

  if (
    normalized === "unknown" ||
    normalized === ""
  ) {
    return null;
  }

  // Preserve PCGamingWiki states such as:
  //
  // hackable
  // limited
  // always on
  //
  // FeatureCard can display these as custom states.
  return value;
}

function mergePcgwData(
  game,
  data
) {
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

      pcgwError:
        "No matching PCGamingWiki page was found.",

      description:
        "Game Manager could not find a matching PCGamingWiki page for this title.",
    };
  }

  return {
    ...game,

    pcgwLoaded: true,
    pcgwLoading: false,
    pcgwError: null,

    pcgwPageName:
      data.pageName,

    pcgwPageUrl:
      data.pageUrl,

    developer:
      data.developer,

    publisher:
      data.publisher,

    releaseDate:
      data.releaseDate,

    description:
      data.pageName
        ? `PCGamingWiki data loaded from ${data.pageName}.`
        : "PCGamingWiki data loaded.",

    features: {
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
    },

    technical: {
      ...game.technical,

      engine:
        data.engine,
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
        data.available,

      status:
        data.status,

      matchedName:
        data.matchedName,

      category:
        data.category,

      notes:
        data.notes,

      pageUrl:
        data.pageUrl,
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
    useState(true);

  const [
    scanError,
    setScanError,
  ] =
    useState(null);

  // =========================================================
  // Installed-game scanner
  // =========================================================

  async function scanGames() {
    console.log(
      "[Game Manager] Starting installed-game scan"
    );

    setLoading(true);
    setScanError(null);

    try {
      const installedGames =
        await getInstalledGames();

      console.log(
        "[Game Manager] Installed games:",
        installedGames
      );

      const preparedGames =
        installedGames.map(
          prepareGameForUi
        );

      setGames(
        preparedGames
      );

      // Reset selection after a complete rescan.
      setSelectedGame(
        null
      );
    } catch (error) {
      console.error(
        "[Game Manager] Installed-game scan failed:",
        error
      );

      setGames([]);

      setSelectedGame(
        null
      );

      setScanError(
        "Game Manager could not scan the installed game libraries."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // Initial scan
  // =========================================================

useEffect(() => {
  console.log(
    "[Game Manager] App mounted"
  );

  scanGames();

  async function checkUpdates() {
    try {
      const update =
        await checkForUpdates();

      if (update) {
        console.log(
          `[Updater] Version ${update.version} is available`
        );

        // We'll add the visible update dialog next.
      }
    } catch (error) {
      console.error(
        "[Updater] Update check failed:",
        error
      );
    }
  }

  checkUpdates();
}, []);

  // =========================================================
  // Game selection
  // =========================================================

  async function selectGame(game) {
    console.log(
      "[Game Manager] Selected:",
      game.name
    );

    // Show the game immediately.
    setSelectedGame(
      game
    );

    // If both external services have already been loaded,
    // there is nothing else to request.
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

      pcgwError:
        game.pcgwLoaded
          ? game.pcgwError
          : null,

      renodxLoading:
        !game.renodxLoaded,

      renodxError:
        game.renodxLoaded
          ? game.renodxError
          : null,
    };

    // Immediately update the UI so loading indicators appear.
    setSelectedGame(
      loadingGame
    );

    setGames(
      (currentGames) =>
        currentGames.map(
          (currentGame) =>
            currentGame.id ===
            game.id
              ? loadingGame
              : currentGame
        )
    );

    // -------------------------------------------------------
    // Build the requests
    // -------------------------------------------------------

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

    // Run both requests at the same time.
    const [
      pcgwResult,
      renodxResult,
    ] =
      await Promise.allSettled([
        pcgwPromise,
        renodxPromise,
      ]);

    // Only one declaration of updatedGame.
    // We modify this variable as each result is processed.
    let updatedGame =
      loadingGame;

    // -------------------------------------------------------
    // PCGamingWiki result
    // -------------------------------------------------------

    if (!game.pcgwLoaded) {
      if (
        pcgwResult.status ===
        "fulfilled"
      ) {
        console.log(
          "[PCGW] Loaded:",
          pcgwResult.value
        );

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

          pcgwLoading: false,

          pcgwError:
            "PCGamingWiki data could not be loaded.",
        };
      }
    }

    // -------------------------------------------------------
    // RenoDX result
    // -------------------------------------------------------

    if (!game.renodxLoaded) {
      if (
        renodxResult.status ===
        "fulfilled"
      ) {
        console.log(
          "[RenoDX] Loaded:",
          renodxResult.value
        );

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

          renodxLoading: false,

          renodxError:
            "RenoDX compatibility could not be checked.",
        };
      }
    }

    // -------------------------------------------------------
    // Save final merged game
    // -------------------------------------------------------

    setGames(
      (currentGames) =>
        currentGames.map(
          (currentGame) =>
            currentGame.id ===
            game.id
              ? updatedGame
              : currentGame
        )
    );

    setSelectedGame(
      updatedGame
    );
  }

  // =========================================================
  // Search/filter
  // =========================================================

  const filteredGames =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return games;
        }

        return games.filter(
          (game) =>
            game.name
              .toLowerCase()
              .includes(query)
        );
      },
      [
        games,
        search,
      ]
    );

  // =========================================================
  // UI
  // =========================================================

  return (
    <div
      className="
        flex
        h-screen
        w-screen
        overflow-hidden
        bg-[#090b10]
      "
    >
      <Sidebar
        games={
          filteredGames
        }
        totalGames={
          games.length
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
      />

      <GameDetails
        game={
          selectedGame
        }
      />
    </div>
  );
}