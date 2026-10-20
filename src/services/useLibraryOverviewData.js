import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getLibraryInsights,
  getLibrarySnapshot,
} from "./libraryInsights";

import {
  getLibraryAnalysisSummary,
} from "./analysisState";

import {
  getSettings,
} from "./settings";

import {
  getGameUserMetadata,
} from "./userGameMetadata";

import {
  getInstallationHealthSummary,
} from "./installationHealth";


// Shared by the library overview and the library tools screen so both read
// the same counts and refresh on the same events.
export function useLibraryOverviewData(
  games,
  libraryAnalysis
) {
  const [
    revision,
    setRevision,
  ] =
    useState(0);

  useEffect(
    () => {
      const refresh =
        () =>
          setRevision(
            (value) =>
              value + 1
          );

      const events = [
        "game-manager-launch-history-changed",
        "game-manager-library-insights-changed",
        "game-manager-library-snapshot-changed",
        "game-manager-user-metadata-changed",
        "game-manager-analysis-state-changed",
        "game-manager-settings-changed",
        "game-manager-installation-health-changed",
        "storage",
      ];

      events.forEach(
        (event) =>
          window.addEventListener(
            event,
            refresh
          )
      );

      return () =>
        events.forEach(
          (event) =>
            window.removeEventListener(
              event,
              refresh
            )
        );
    },
    []
  );

  const data =
    useMemo(
      () => {
        const snapshot =
          getLibrarySnapshot();

        const snapshotGames =
          Object.values(
            snapshot.games
            ?? {}
          );

        const installedGames =
          games.length > 0
            ? games
            : snapshotGames;

        const insights =
          Object.values(
            getLibraryInsights()
          );

        const stores =
          installedGames.reduce(
            (
              result,
              game
            ) => {
              const store =
                game.store
                ?? "Unknown";

              result[store] =
                (
                  result[store]
                  ?? 0
                ) + 1;

              return result;
            },
            {}
          );

        const count =
          (predicate) =>
            insights.filter(
              predicate
            ).length;

        const settings =
          getSettings();

        const analysis =
          getLibraryAnalysisSummary(
            installedGames,
            settings
              .analysisFreshDays
          );

        const health =
          getInstallationHealthSummary(
            installedGames
          );

        return {
          games:
            installedGames,

          total:
            installedGames.length,

          indexed:
            installedGames.length,

          analyzed:
            insights.length,

          favorites:
            installedGames.filter(
              (game) =>
                getGameUserMetadata(
                  game
                ).favorite
            ).length,

          stores,

          analysis,

          health,

          hdr:
            count(
              (row) =>
                row.hdr === true
            ),

          rayTracing:
            count(
              (row) =>
                row.rayTracing === true
            ),

          frameGeneration:
            count(
              (row) =>
                row.frameGeneration === true
            ),

          ultrawide:
            count(
              (row) =>
                row.ultrawide === true
            ),

          renodx:
            count(
              (row) =>
                row.renodx
            ),

          luma:
            count(
              (row) =>
                row.luma
            ),

          vortex:
            count(
              (row) =>
                row.vortex
            ),

          fluffy:
            count(
              (row) =>
                row.fluffy
            ),
        };
      },
      [
        games,
        revision,
        libraryAnalysis
          ?.state,
        libraryAnalysis
          ?.completed,
      ]
    );

  const storeRows =
    Object.entries(
      data.stores
    )
      .sort(
        (
          left,
          right
        ) =>
          right[1]
          - left[1]
      );

  return {
    data,
    storeRows,
    revision,
  };
}
