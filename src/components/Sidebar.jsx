import {
  ChevronDown,
  ChevronUp,
  EyeOff,
  Eye,
  Filter,
  LayoutDashboard,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Star,
  Tag,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import StoreBadge from "./StoreBadge";

import {
  gameHasTag,
  gameMatchesUserMetadataSearch,
  getAllGameTags,
  getGameUserMetadata,
  isGameFavorite,
} from "../services/userGameMetadata";

import {
  getGameInsight,
  getLibraryInsights,
  insightMatchesFilter,
} from "../services/libraryInsights";


const FILTER_STORAGE_KEY =
  "game-manager-library-filters";


function loadLibraryPreferences() {
  try {
    const stored =
      localStorage.getItem(
        FILTER_STORAGE_KEY
      );

    if (!stored) {
      return {
        favoritesOnly:
          false,

        selectedTag:
          "",

        selectedInsight:
          "",

        sortMode:
          "name",
      };
    }

    const parsed =
      JSON.parse(
        stored
      );

    return {
      favoritesOnly:
        Boolean(
          parsed?.favoritesOnly
        ),

      selectedTag:
        typeof parsed?.selectedTag
          === "string"
          ? parsed.selectedTag
          : "",

      selectedInsight:
        typeof parsed?.selectedInsight
          === "string"
          ? parsed.selectedInsight
          : "",

      sortMode:
        [
          "name",
          "favorites",
          "store",
        ].includes(
          parsed?.sortMode
        )
          ? parsed.sortMode
          : "name",
    };
  } catch {
    return {
      favoritesOnly:
        false,

      selectedTag:
        "",

      selectedInsight:
        "",

      sortMode:
        "name",
    };
  }
}


function saveLibraryPreferences(
  value
) {
  try {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify(
        value
      )
    );
  } catch (error) {
    console.error(
      "[Library Filters] Failed to save:",
      error
    );
  }
}


function GameRow({
  game,
  selected,
  hiddenView,
  onSelect,
  onHide,
  onRestore,
  compact = false,
}) {
  const metadata =
    getGameUserMetadata(
      game
    );

  return (
    <div
      className={`
        group
        relative
        rounded-xl
        border
        transition
        ${
          selected
            ? "border-cyan-500/30 bg-cyan-500/[0.08]"
            : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.025]"
        }
      `}
    >
      <button
        type="button"
        onClick={
          () =>
            onSelect(
              game
            )
        }
        className={`
          block
          w-full
          px-3
          pr-10
          text-left
          ${
            compact
              ? "py-2"
              : "py-3"
          }
        `}
      >
        <div
          className="
            flex
            items-start
            gap-2
          "
        >
          <div
            className="
              min-w-0
              flex-1
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              {metadata.favorite ? (
                <Star
                  className="
                    h-3.5
                    w-3.5
                    shrink-0
                    fill-amber-300
                    text-amber-300
                  "
                />
              ) : null}

              <div
                className="
                  truncate
                  text-sm
                  font-semibold
                  text-white/80
                "
                title={
                  game.name
                }
              >
                {game.name}
              </div>
            </div>

            <div
              className="
                mt-1.5
                flex
                flex-wrap
                items-center
                gap-1.5
              "
            >
              <StoreBadge
                store={
                  game.store
                }
              />

              {metadata.tags
                .slice(
                  0,
                  2
                )
                .map(
                  (tag) => (
                    <span
                      key={
                        tag.toLocaleLowerCase()
                      }
                      className="
                        max-w-[90px]
                        truncate
                        rounded-full
                        border
                        border-white/[0.08]
                        bg-white/[0.025]
                        px-1.5
                        py-0.5
                        text-[9px]
                        font-medium
                        text-white/35
                      "
                      title={
                        tag
                      }
                    >
                      {tag}
                    </span>
                  )
                )}

              {metadata.tags.length
                > 2 ? (
                <span
                  className="
                    text-[9px]
                    text-white/25
                  "
                >
                  +{
                    metadata.tags.length
                    - 2
                  }
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={
          (event) => {
            event.stopPropagation();

            if (hiddenView) {
              onRestore(
                game
              );
            } else {
              onHide(
                game
              );
            }
          }
        }
        className="
          absolute
          right-2
          top-2.5
          flex
          h-7
          w-7
          items-center
          justify-center
          rounded-lg
          text-white/20
          opacity-0
          transition
          hover:bg-white/[0.07]
          hover:text-white/65
          group-hover:opacity-100
        "
        title={
          hiddenView
            ? "Restore game"
            : "Hide game"
        }
      >
        {hiddenView ? (
          <RotateCcw
            className="h-3.5 w-3.5"
          />
        ) : (
          <EyeOff
            className="h-3.5 w-3.5"
          />
        )}
      </button>
    </div>
  );
}


export default function Sidebar({
  games,
  totalGames,
  visibleGameCount,
  hiddenGameCount,
  selectedGame,
  onSelectGame,
  onShowDashboard,
  onShowSettings,
  settingsActive = false,
  search: _externalSearch,
  onSearchChange: _onExternalSearchChange,
  loading,
  scanError,
  onRescan,
  showHiddenGames,
  onShowHiddenGamesChange,
  onHideGame,
  onRestoreGame,
  onRestoreAllHiddenGames,
}) {
  const initial =
    loadLibraryPreferences();

  const [
    query,
    setQuery,
  ] =
    useState("");

  const [
    favoritesOnly,
    setFavoritesOnly,
  ] =
    useState(
      initial.favoritesOnly
    );

  const [
    selectedTag,
    setSelectedTag,
  ] =
    useState(
      initial.selectedTag
    );

  const [
    selectedInsight,
    setSelectedInsight,
  ] =
    useState(
      initial.selectedInsight
      ?? ""
    );

  const [
    sortMode,
    setSortMode,
  ] =
    useState(
      initial.sortMode
    );

  const [
    metadataRevision,
    setMetadataRevision,
  ] =
    useState(0);

  const [
    filtersExpanded,
    setFiltersExpanded,
  ] =
    useState(false);

  const [
    compactGameRows,
    setCompactGameRows,
  ] =
    useState(
      () => {
        try {
          const raw =
            localStorage.getItem(
              "game-manager-settings-v1"
            );

          return Boolean(
            raw
              ? JSON.parse(raw)
                  ?.compactGameRows
              : false
          );
        } catch {
          return false;
        }
      }
    );


  useEffect(
    () => {
      const refreshSettings =
        () => {
          try {
            const raw =
              localStorage.getItem(
                "game-manager-settings-v1"
              );

            setCompactGameRows(
              Boolean(
                raw
                  ? JSON.parse(raw)
                      ?.compactGameRows
                  : false
              )
            );
          } catch {
            setCompactGameRows(
              false
            );
          }
        };

      window.addEventListener(
        "game-manager-settings-changed",
        refreshSettings
      );

      return () => {
        window.removeEventListener(
          "game-manager-settings-changed",
          refreshSettings
        );
      };
    },
    []
  );


  useEffect(
    () => {
      const refresh =
        () =>
          setMetadataRevision(
            (current) =>
              current + 1
          );

      window.addEventListener(
        "game-manager-user-metadata-changed",
        refresh
      );

      window.addEventListener(
        "game-manager-library-insights-changed",
        refresh
      );

      window.addEventListener(
        "storage",
        refresh
      );

      return () => {
        window.removeEventListener(
          "game-manager-user-metadata-changed",
          refresh
        );

        window.removeEventListener(
          "game-manager-library-insights-changed",
          refresh
        );

        window.removeEventListener(
          "storage",
          refresh
        );
      };
    },
    []
  );


  useEffect(
    () => {
      saveLibraryPreferences(
        {
          favoritesOnly,
          selectedTag,
          selectedInsight,
          sortMode,
        }
      );
    },
    [
      favoritesOnly,
      selectedTag,
      selectedInsight,
      sortMode,
    ]
  );


  const analyzedCount =
    useMemo(
      () =>
        Object.keys(
          getLibraryInsights()
        ).length,
      [
        metadataRevision,
      ]
    );

  const availableTags =
    useMemo(
      () =>
        getAllGameTags(
          games
        ),
      [
        games,
        metadataRevision,
      ]
    );


  useEffect(
    () => {
      if (
        selectedTag
        && !availableTags
          .some(
            (entry) =>
              entry.tag
                .toLocaleLowerCase()
              === selectedTag
                .toLocaleLowerCase()
          )
      ) {
        setSelectedTag(
          ""
        );
      }
    },
    [
      availableTags,
      selectedTag,
    ]
  );


  const filteredGames =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLocaleLowerCase();

        let next =
          (games ?? [])
            .filter(
              (game) => {
                if (
                  favoritesOnly
                  && !isGameFavorite(
                    game
                  )
                ) {
                  return false;
                }

                if (
                  selectedTag
                  && !gameHasTag(
                    game,
                    selectedTag
                  )
                ) {
                  return false;
                }

                if (
                  selectedInsight
                  && !insightMatchesFilter(
                    getGameInsight(game),
                    selectedInsight
                  )
                ) {
                  return false;
                }

                if (!normalizedQuery) {
                  return true;
                }

                const basicMatch =
                  game.name
                    ?.toLocaleLowerCase()
                    .includes(
                      normalizedQuery
                    )
                  || game.store
                    ?.toLocaleLowerCase()
                    .includes(
                      normalizedQuery
                    );

                return (
                  basicMatch
                  || gameMatchesUserMetadataSearch(
                    game,
                    normalizedQuery
                  )
                );
              }
            );

        next =
          [
            ...next,
          ];

        next.sort(
          (left, right) => {
            if (
              sortMode
              === "favorites"
            ) {
              const favoriteDifference =
                Number(
                  isGameFavorite(
                    right
                  )
                )
                - Number(
                    isGameFavorite(
                      left
                    )
                  );

              if (
                favoriteDifference
                !== 0
              ) {
                return favoriteDifference;
              }
            }

            if (
              sortMode
              === "store"
            ) {
              const storeDifference =
                String(
                  left.store
                  ?? ""
                )
                .localeCompare(
                  String(
                    right.store
                    ?? ""
                  ),
                  undefined,
                  {
                    sensitivity:
                      "base",
                  }
                );

              if (
                storeDifference
                !== 0
              ) {
                return storeDifference;
              }
            }

            return String(
              left.name
              ?? ""
            )
              .localeCompare(
                String(
                  right.name
                  ?? ""
                ),
                undefined,
                {
                  sensitivity:
                    "base",
                }
              );
          }
        );

        return next;
      },
      [
        games,
        query,
        favoritesOnly,
        selectedTag,
        selectedInsight,
        sortMode,
        metadataRevision,
      ]
    );


  const hasActiveFilters =
    favoritesOnly
    || Boolean(
      selectedTag
    )
    || Boolean(
      selectedInsight
    )
    || sortMode
      !== "name";


  function resetFilters() {
    setFavoritesOnly(
      false
    );

    setSelectedTag(
      ""
    );

    setSelectedInsight(
      ""
    );

    setSortMode(
      "name"
    );
  }


  return (
    <aside
      className="
        flex
        h-screen
        w-[340px]
        shrink-0
        flex-col
        border-r
        border-white/[0.07]
        bg-[#0d121b]
      "
    >
      <div
        className="
          border-b
          border-white/[0.07]
          p-4
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            gap-3
          "
        >
          <div>
            <div
              className="
                text-base
                font-bold
                tracking-tight
                text-white
              "
            >
              Game Manager
            </div>

            <div
              className="
                mt-0.5
                text-[11px]
                text-white/30
              "
            >
              {showHiddenGames
                ? `${hiddenGameCount} hidden`
                : `${visibleGameCount} of ${totalGames} installed`
              }
            </div>
          </div>

          <button
            type="button"
            onClick={
              onRescan
            }
            disabled={
              loading
            }
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              text-white/40
              transition
              hover:bg-white/[0.06]
              hover:text-white/70
              disabled:opacity-30
            "
            title="Rescan installed games"
          >
            <RefreshCcw
              className={`
                h-4
                w-4
                ${
                  loading
                    ? "animate-spin"
                    : ""
                }
              `}
            />
          </button>
        </div>


        <button
          type="button"
          onClick={
            () => {
              onShowHiddenGamesChange(
                false
              );

              onShowDashboard();
            }
          }
          className={`
            mt-4
            flex
            w-full
            items-center
            gap-3
            rounded-xl
            border
            px-3
            py-2.5
            text-left
            transition
            ${
              !selectedGame
              && !showHiddenGames
                ? "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-100"
                : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/[0.11] hover:bg-white/[0.045] hover:text-white/75"
            }
          `}
          title="Return to Library Overview"
        >
          <div
            className={`
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              ${
                !selectedGame
                && !showHiddenGames
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "bg-white/[0.035] text-white/35"
              }
            `}
          >
            <LayoutDashboard
              className="h-4 w-4"
            />
          </div>

          <div
            className="
              min-w-0
              flex-1
            "
          >
            <div
              className="
                text-sm
                font-semibold
              "
            >
              Library Overview
            </div>

            <div
              className="
                mt-0.5
                text-[10px]
                opacity-55
              "
            >
              Dashboard & library statistics
            </div>
          </div>
        </button>


        <button
          type="button"
          onClick={
            onShowSettings
          }
          className={`
            mt-2
            flex
            w-full
            items-center
            gap-3
            rounded-xl
            border
            px-3
            py-2
            text-left
            transition
            ${
              settingsActive
                ? "border-cyan-500/30 bg-cyan-500/[0.08] text-cyan-100"
                : "border-white/[0.07] bg-white/[0.02] text-white/45 hover:border-white/[0.11] hover:bg-white/[0.045] hover:text-white/75"
            }
          `}
          title="Open Game Manager settings"
        >
          <div
            className={`
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              ${
                settingsActive
                  ? "bg-cyan-500/10 text-cyan-300"
                  : "bg-white/[0.035] text-white/35"
              }
            `}
          >
            <Settings2
              className="h-4 w-4"
            />
          </div>

          <div
            className="
              min-w-0
              flex-1
            "
          >
            <div
              className="
                text-sm
                font-semibold
              "
            >
              Settings
            </div>

            <div
              className="
                mt-0.5
                text-[10px]
                opacity-55
              "
            >
              Preferences & cache controls
            </div>
          </div>
        </button>


        <div
          className="
            relative
            mt-3
          "
        >
          <Search
            className="
              absolute
              left-3
              top-1/2
              h-4
              w-4
              -translate-y-1/2
              text-white/25
            "
          />

          <input
            type="text"
            value={
              query
            }
            onChange={
              (event) =>
                setQuery(
                  event.target.value
                )
            }
            placeholder="Search games or tags…"
            className="
              w-full
              rounded-xl
              border
              border-white/[0.08]
              bg-black/20
              py-2.5
              pl-9
              pr-9
              text-sm
              text-white/80
              outline-none
              transition
              placeholder:text-white/20
              focus:border-cyan-500/30
            "
          />

          {query ? (
            <button
              type="button"
              onClick={
                () =>
                  setQuery(
                    ""
                  )
              }
              className="
                absolute
                right-2
                top-1/2
                flex
                h-6
                w-6
                -translate-y-1/2
                items-center
                justify-center
                rounded-md
                text-white/25
                hover:bg-white/[0.06]
                hover:text-white/60
              "
            >
              <X
                className="h-3.5 w-3.5"
              />
            </button>
          ) : null}
        </div>


        <div
          className="
            mt-3
            grid
            grid-cols-2
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              () =>
                onShowHiddenGamesChange(
                  false
                )
            }
            className={`
              inline-flex
              items-center
              justify-center
              gap-1.5
              rounded-lg
              border
              px-2
              py-1.5
              text-[11px]
              font-semibold
              transition
              ${
                !showHiddenGames
                  ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-200"
                  : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/60"
              }
            `}
          >
            <Eye
              className="h-3.5 w-3.5"
            />

            Library
          </button>

          <button
            type="button"
            onClick={
              () =>
                onShowHiddenGamesChange(
                  true
                )
            }
            className={`
              inline-flex
              items-center
              justify-center
              gap-1.5
              rounded-lg
              border
              px-2
              py-1.5
              text-[11px]
              font-semibold
              transition
              ${
                showHiddenGames
                  ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-200"
                  : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/60"
              }
            `}
          >
            <EyeOff
              className="h-3.5 w-3.5"
            />

            Hidden
            {
              hiddenGameCount > 0
                ? ` (${hiddenGameCount})`
                : ""
            }
          </button>
        </div>


        {!showHiddenGames ? (
          <>
            <button
              type="button"
              onClick={
                () =>
                  setFiltersExpanded(
                    (current) =>
                      !current
                  )
              }
              className="
                mt-3
                flex
                w-full
                items-center
                justify-between
                gap-3
                rounded-xl
                border
                border-white/[0.07]
                bg-black/10
                px-3
                py-2
                text-left
                transition
                hover:border-white/[0.11]
                hover:bg-white/[0.035]
              "
            >
              <div
                className="
                  flex
                  min-w-0
                  items-center
                  gap-2
                "
              >
                <SlidersHorizontal
                  className="
                    h-3.5
                    w-3.5
                    shrink-0
                    text-cyan-300/65
                  "
                />

                <span
                  className="
                    text-[11px]
                    font-semibold
                    text-white/55
                  "
                >
                  Library Filters
                </span>

                {hasActiveFilters ? (
                  <span
                    className="
                      rounded-full
                      bg-cyan-500/10
                      px-2
                      py-0.5
                      text-[9px]
                      font-semibold
                      text-cyan-200/75
                    "
                  >
                    Active
                  </span>
                ) : null}
              </div>

              {filtersExpanded ? (
                <ChevronUp
                  className="
                    h-3.5
                    w-3.5
                    shrink-0
                    text-white/30
                  "
                />
              ) : (
                <ChevronDown
                  className="
                    h-3.5
                    w-3.5
                    shrink-0
                    text-white/30
                  "
                />
              )}
            </button>

            {filtersExpanded ? (
          <div
            className="
              mt-3
              rounded-xl
              border
              border-white/[0.07]
              bg-black/10
              p-2.5
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
                gap-2
              "
            >
              <button
                type="button"
                onClick={
                  () =>
                    setFavoritesOnly(
                      (current) =>
                        !current
                    )
                }
                className={`
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  px-2.5
                  py-1.5
                  text-[11px]
                  font-semibold
                  transition
                  ${
                    favoritesOnly
                      ? "border-amber-400/30 bg-amber-400/[0.09] text-amber-200"
                      : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/65"
                  }
                `}
              >
                <Star
                  className={`
                    h-3.5
                    w-3.5
                    ${
                      favoritesOnly
                        ? "fill-current"
                        : ""
                    }
                  `}
                />

                Favorites
              </button>

              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={
                    resetFilters
                  }
                  className="
                    text-[10px]
                    font-medium
                    text-white/30
                    transition
                    hover:text-white/60
                  "
                >
                  Reset
                </button>
              ) : null}
            </div>


            <div
              className="
                mt-2
                grid
                grid-cols-2
                gap-2
              "
            >
              <label
                className="
                  min-w-0
                "
              >
                <div
                  className="
                    mb-1
                    flex
                    items-center
                    gap-1
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  <Tag
                    className="h-3 w-3"
                  />

                  Tag
                </div>

                <select
                  value={
                    selectedTag
                  }
                  onChange={
                    (event) =>
                      setSelectedTag(
                        event.target.value
                      )
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-[#111823]
                    px-2
                    py-1.5
                    text-[11px]
                    text-white/60
                    outline-none
                  "
                >
                  <option value="">
                    Any tag
                  </option>

                  {availableTags.map(
                    (entry) => (
                      <option
                        key={
                          entry.tag
                            .toLocaleLowerCase()
                        }
                        value={
                          entry.tag
                        }
                      >
                        {entry.tag} ({entry.count})
                      </option>
                    )
                  )}
                </select>
              </label>


              <label
                className="
                  min-w-0
                "
              >
                <div
                  className="
                    mb-1
                    flex
                    items-center
                    gap-1
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  <SlidersHorizontal
                    className="h-3 w-3"
                  />

                  Sort
                </div>

                <select
                  value={
                    sortMode
                  }
                  onChange={
                    (event) =>
                      setSortMode(
                        event.target.value
                      )
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-[#111823]
                    px-2
                    py-1.5
                    text-[11px]
                    text-white/60
                    outline-none
                  "
                >
                  <option value="name">
                    Name
                  </option>

                  <option value="favorites">
                    Favorites First
                  </option>

                  <option value="store">
                    Store
                  </option>
                </select>
              </label>
            </div>

            <label
              className="
                mt-2
                block
              "
            >
              <div
                className="
                  mb-1
                  flex
                  items-center
                  justify-between
                  gap-2
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/25
                "
              >
                <span>
                  Capability
                </span>

                <span
                  className="
                    normal-case
                    font-normal
                    tracking-normal
                    text-white/18
                  "
                >
                  {analyzedCount} analyzed
                </span>
              </div>

              <select
                value={
                  selectedInsight
                }
                onChange={
                  (event) =>
                    setSelectedInsight(
                      event.target.value
                    )
                }
                className="
                  w-full
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-[#111823]
                  px-2
                  py-1.5
                  text-[11px]
                  text-white/60
                  outline-none
                "
              >
                <option value="">
                  All capabilities
                </option>

                <optgroup label="Graphics">
                  <option value="hdr">
                    HDR
                  </option>

                  <option value="ray-tracing">
                    Ray Tracing
                  </option>

                  <option value="upscaling">
                    Upscaling
                  </option>

                  <option value="dlss">
                    DLSS
                  </option>

                  <option value="frame-generation">
                    Frame Generation
                  </option>

                  <option value="dlss-frame-generation">
                    DLSS Frame Generation
                  </option>

                  <option value="ultrawide">
                    Ultrawide
                  </option>

                  <option value="4k">
                    4K
                  </option>

                  <option value="120fps">
                    120+ FPS
                  </option>
                </optgroup>

                <optgroup label="Mods & Enhancements">
                  <option value="renodx">
                    RenoDX
                  </option>

                  <option value="luma">
                    Luma
                  </option>

                  <option value="vortex">
                    Vortex Supported
                  </option>

                  <option value="fluffy">
                    Fluffy Supported
                  </option>
                </optgroup>
              </select>

              {selectedInsight ? (
                <div
                  className="
                    mt-1
                    text-[9px]
                    leading-relaxed
                    text-white/18
                  "
                >
                  Capability filters match analyzed games only.
                </div>
              ) : null}
            </label>
          </div>
            ) : null}
          </>
        ) : null}
      </div>


      {scanError ? (
        <div
          className="
            mx-3
            mt-3
            rounded-xl
            border
            border-red-500/20
            bg-red-500/[0.05]
            px-3
            py-2.5
            text-xs
            leading-relaxed
            text-red-300/70
          "
        >
          {scanError}
        </div>
      ) : null}


      <div
        className="
          flex
          min-h-0
          flex-1
          flex-col
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            px-4
            py-3
            text-[11px]
            text-white/30
          "
        >
          <span>
            {filteredGames.length}{" "}
            {filteredGames.length === 1
              ? "game"
              : "games"
            }
          </span>

          {showHiddenGames
            && hiddenGameCount > 0 ? (
            <button
              type="button"
              onClick={
                onRestoreAllHiddenGames
              }
              className="
                font-medium
                text-cyan-300/60
                hover:text-cyan-200
              "
            >
              Restore all
            </button>
          ) : null}
        </div>


        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            px-2
            pb-4
          "
        >
          {loading
            && games.length === 0 ? (
            <div
              className="
                px-3
                py-8
                text-center
                text-sm
                text-white/30
              "
            >
              Scanning installed games…
            </div>
          ) : filteredGames.length === 0 ? (
            <div
              className="
                px-4
                py-8
                text-center
              "
            >
              <Filter
                className="
                  mx-auto
                  h-6
                  w-6
                  text-white/20
                "
              />

              <div
                className="
                  mt-3
                  text-sm
                  font-medium
                  text-white/40
                "
              >
                No games match
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  leading-relaxed
                  text-white/25
                "
              >
                Try clearing the search
                or library filters.
              </div>
            </div>
          ) : (
            <div
              className="
                space-y-1
              "
            >
              {filteredGames.map(
                (game) => (
                  <GameRow
                    key={
                      `${game.store}-${game.launcherId ?? game.id}-${game.installPath}`
                    }
                    game={
                      game
                    }
                    selected={
                      selectedGame?.id
                      === game.id
                    }
                    hiddenView={
                      showHiddenGames
                    }
                    onSelect={
                      onSelectGame
                    }
                    onHide={
                      onHideGame
                    }
                    onRestore={
                      onRestoreGame
                    }
                    compact={
                      compactGameRows
                    }
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
