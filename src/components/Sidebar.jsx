import {
  Bookmark,
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
  Save,
  Sparkles,
  Star,
  Tag,
  Trash2,
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


import {
  getBatchHealthResult,
} from "../services/installationHealthBatch";

const CAPABILITY_FILTERS = [
  { id: "hdr", label: "HDR", group: "Graphics" },
  { id: "ray-tracing", label: "Ray Tracing", group: "Graphics" },
  { id: "upscaling", label: "Upscaling", group: "Graphics" },
  { id: "dlss", label: "DLSS", group: "Graphics" },
  { id: "frame-generation", label: "Frame Gen", group: "Graphics" },
  { id: "dlss-frame-generation", label: "DLSS FG", group: "Graphics" },
  { id: "ultrawide", label: "Ultrawide", group: "Graphics" },
  { id: "4k", label: "4K", group: "Graphics" },
  { id: "120fps", label: "120+ FPS", group: "Graphics" },
  { id: "renodx", label: "RenoDX", group: "Mods" },
  { id: "luma", label: "Luma", group: "Mods" },
  { id: "vortex", label: "Vortex", group: "Mods" },
  { id: "fluffy", label: "Fluffy", group: "Mods" },
];

const CAPABILITY_IDS =
  new Set(
    CAPABILITY_FILTERS.map(
      (filter) =>
        filter.id
    )
  );


function normalizeCapabilityList(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (item) =>
          typeof item === "string"
          && CAPABILITY_IDS.has(
            item
          )
      )
    )
  );
}


function capabilityState(
  capabilityId,
  includedCapabilities,
  excludedCapabilities
) {
  if (
    includedCapabilities.includes(
      capabilityId
    )
  ) {
    return "include";
  }

  if (
    excludedCapabilities.includes(
      capabilityId
    )
  ) {
    return "exclude";
  }

  return "off";
}


function CapabilityChip({
  capability,
  state,
  onCycle,
}) {
  return (
    <button
      type="button"
      onClick={
        () =>
          onCycle(
            capability.id
          )
      }
      className={`
        inline-flex
        min-h-7
        items-center
        justify-center
        gap-1
        rounded-lg
        border
        px-2
        py-1
        text-[10px]
        font-semibold
        transition
        ${
          state === "include"
            ? "border-cyan-400/30 bg-cyan-400/[0.10] text-cyan-200"
            : state === "exclude"
              ? "border-red-400/25 bg-red-400/[0.08] text-red-200/85"
              : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:border-white/[0.12] hover:text-white/60"
        }
      `}
      title={
        state === "include"
          ? `${capability.label}: required`
          : state === "exclude"
            ? `${capability.label}: excluded`
            : `${capability.label}: not filtered`
      }
    >
      <span
        className={`
          text-[9px]
          ${
            state === "include"
              ? "text-cyan-300"
              : state === "exclude"
                ? "text-red-300"
                : "text-white/20"
          }
        `}
      >
        {state === "include"
          ? "+"
          : state === "exclude"
            ? "−"
            : "·"}
      </span>

      {capability.label}
    </button>
  );
}


const FILTER_STORAGE_KEY =
  "game-manager-library-filters";


const STORE_FILTER_ALIASES = {
  steam: [
    "steam",
  ],

  epic: [
    "epic",
    "epic games",
    "epic games store",
    "epic games launcher",
  ],

  ea: [
    "ea",
    "ea app",
    "origin",
    "origin games",
  ],

  gog: [
    "gog",
    "gog.com",
    "gog galaxy",
  ],

  ubisoft: [
    "ubisoft",
    "ubisoft connect",
    "uplay",
  ],

  xbox: [
    "xbox",
    "microsoft store",
    "xbox / microsoft store",
    "xbox app",
  ],
};


function normalizeStoreFilterValue(
  value
) {
  const normalized =
    String(
      value
      ?? ""
    )
    .trim()
    .toLocaleLowerCase();

  for (const [
    canonical,
    aliases,
  ] of Object.entries(
    STORE_FILTER_ALIASES
  )) {
    if (
      aliases.includes(
        normalized
      )
    ) {
      return canonical;
    }
  }

  return normalized;
}


const SAVED_VIEWS_STORAGE_KEY =
  "game-manager-saved-views-v1";


function loadSavedViews() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          SAVED_VIEWS_STORAGE_KEY
        )
        ?? "[]"
      );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (view) =>
          view
          && typeof view.id === "string"
          && typeof view.name === "string"
      )
      .map(
        (view) => ({
          id:
            view.id,

          name:
            view.name,

          createdAt:
            view.createdAt
            ?? null,

          updatedAt:
            view.updatedAt
            ?? null,

          filters: {
            favoritesOnly:
              Boolean(
                view.filters
                  ?.favoritesOnly
              ),

            selectedTag:
              typeof view.filters
                ?.selectedTag === "string"
                ? view.filters.selectedTag
                : "",

            selectedStore:
              typeof view.filters
                ?.selectedStore === "string"
                ? view.filters.selectedStore
                : "",

            specialFilter:
              [
                "",
                "needs-installation-attention",
                "unanalyzed",
              ].includes(
                view.filters
                  ?.specialFilter
              )
                ? view.filters.specialFilter
                : "",

            includedCapabilities:
              normalizeCapabilityList(
                view.filters
                  ?.includedCapabilities
              ),

            excludedCapabilities:
              normalizeCapabilityList(
                view.filters
                  ?.excludedCapabilities
              ),

            capabilityMatchMode:
              view.filters
                ?.capabilityMatchMode === "any"
                ? "any"
                : "all",

            sortMode:
              [
                "name",
                "name-desc",
                "analyzed-first",
                "unanalyzed-first",
                "favorites",
                "store",
              ].includes(
                view.filters
                  ?.sortMode
              )
                ? view.filters.sortMode
                : "name",
          },
        })
      );
  } catch {
    return [];
  }
}


function saveSavedViews(
  views
) {
  try {
    localStorage.setItem(
      SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify(
        views
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "game-manager-saved-views-changed"
      )
    );
  } catch (error) {
    console.error(
      "[Saved Views] Failed to save:",
      error
    );
  }
}


function makeSavedViewId() {
  if (
    typeof crypto !== "undefined"
    && typeof crypto.randomUUID
      === "function"
  ) {
    return crypto.randomUUID();
  }

  return `view-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}


function loadLibraryPreferences() {
  const defaults = {
    favoritesOnly:
      false,

    selectedTag:
      "",

    selectedStore:
      "",

    specialFilter:
      "",

    includedCapabilities:
      [],

    excludedCapabilities:
      [],

    capabilityMatchMode:
      "all",

    sortMode:
      "name",
  };

  try {
    const stored =
      localStorage.getItem(
        FILTER_STORAGE_KEY
      );

    if (!stored) {
      return defaults;
    }

    const parsed =
      JSON.parse(
        stored
      );

    /*
     * v1.1 -> v1.2 migration:
     * Preserve the old single capability filter.
     */
    let includedCapabilities =
      normalizeCapabilityList(
        parsed?.includedCapabilities
      );

    if (
      includedCapabilities.length === 0
      && typeof parsed?.selectedInsight === "string"
      && CAPABILITY_IDS.has(
        parsed.selectedInsight
      )
    ) {
      includedCapabilities = [
        parsed.selectedInsight,
      ];
    }

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

      selectedStore:
        typeof parsed?.selectedStore
          === "string"
          ? parsed.selectedStore
          : "",

      specialFilter:
        [
          "",
          "needs-installation-attention",
          "unanalyzed",
        ].includes(
          parsed?.specialFilter
        )
          ? parsed.specialFilter
          : "",

      includedCapabilities,

      excludedCapabilities:
        normalizeCapabilityList(
          parsed?.excludedCapabilities
        ).filter(
          (capabilityId) =>
            !includedCapabilities.includes(
              capabilityId
            )
        ),

      capabilityMatchMode:
        parsed?.capabilityMatchMode
          === "any"
          ? "any"
          : "all",

      sortMode:
        [
          "name",
          "name-desc",
          "analyzed-first",
          "unanalyzed-first",
          "favorites",
          "store",
        ].includes(
          parsed?.sortMode
        )
          ? parsed.sortMode
          : "name",
    };
  } catch {
    return defaults;
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
        border
        transition
        ${
          compact
            ? "rounded-lg"
            : "rounded-xl"
        }
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
          text-left
          ${
            compact
              ? "min-h-[38px] px-2.5 py-1.5 pr-8"
              : "px-3 py-3 pr-10"
          }
        `}
      >
        {compact ? (
          <div
            className="
              flex
              min-w-0
              items-center
              gap-2
            "
          >
            {metadata.favorite ? (
              <Star
                className="
                  h-3
                  w-3
                  shrink-0
                  fill-amber-300
                  text-amber-300
                "
              />
            ) : null}

            <div
              className="
                min-w-0
                flex-1
                truncate
                text-[12px]
                font-semibold
                leading-5
                text-white/75
              "
              title={
                game.name
              }
            >
              {game.name}
            </div>

            <span
              className="
                shrink-0
                rounded-md
                border
                border-white/[0.07]
                bg-white/[0.02]
                px-1.5
                py-0.5
                text-[8px]
                font-semibold
                uppercase
                tracking-wide
                text-white/28
              "
              title={
                game.store
              }
            >
              {game.store}
            </span>
          </div>
        ) : (
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
        )}
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
        className={`
          absolute
          flex
          items-center
          justify-center
          text-white/20
          opacity-0
          transition
          hover:bg-white/[0.07]
          hover:text-white/65
          group-hover:opacity-100
          ${
            compact
              ? "right-1 top-1 h-7 w-7 rounded-md"
              : "right-2 top-2.5 h-7 w-7 rounded-lg"
          }
        `}
        title={
          hiddenView
            ? "Restore game"
            : "Hide game"
        }
      >
        {hiddenView ? (
          <RotateCcw
            className={
              compact
                ? "h-3 w-3"
                : "h-3.5 w-3.5"
            }
          />
        ) : (
          <EyeOff
            className={
              compact
                ? "h-3 w-3"
                : "h-3.5 w-3.5"
            }
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
    selectedStore,
    setSelectedStore,
  ] =
    useState(
      initial.selectedStore
      ?? ""
    );

  const [
    specialFilter,
    setSpecialFilter,
  ] =
    useState(
      initial.specialFilter
      ?? ""
    );

  const [
    includedCapabilities,
    setIncludedCapabilities,
  ] =
    useState(
      initial.includedCapabilities
      ?? []
    );

  const [
    excludedCapabilities,
    setExcludedCapabilities,
  ] =
    useState(
      initial.excludedCapabilities
      ?? []
    );

  const [
    capabilityMatchMode,
    setCapabilityMatchMode,
  ] =
    useState(
      initial.capabilityMatchMode
      ?? "all"
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
    savedViews,
    setSavedViews,
  ] =
    useState(
      () =>
        loadSavedViews()
    );

  const [
    savedViewName,
    setSavedViewName,
  ] =
    useState("");

  const [
    activeSavedViewId,
    setActiveSavedViewId,
  ] =
    useState(null);

  const [
    savedViewMessage,
    setSavedViewMessage,
  ] =
    useState(null);

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
      const refreshSavedViews =
        () => {
          const next =
            loadSavedViews();

          setSavedViews(
            next
          );

          setActiveSavedViewId(
            (current) =>
              current
              && next.some(
                (view) =>
                  view.id === current
              )
                ? current
                : null
          );
        };

      window.addEventListener(
        "game-manager-saved-views-changed",
        refreshSavedViews
      );

      window.addEventListener(
        "storage",
        refreshSavedViews
      );

      return () => {
        window.removeEventListener(
          "game-manager-saved-views-changed",
          refreshSavedViews
        );

        window.removeEventListener(
          "storage",
          refreshSavedViews
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
          selectedStore,
          specialFilter,
          includedCapabilities,
          excludedCapabilities,
          capabilityMatchMode,
          sortMode,
        }
      );
    },
    [
      favoritesOnly,
      selectedTag,
      selectedStore,
      specialFilter,
      includedCapabilities,
      excludedCapabilities,
      capabilityMatchMode,
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
                  selectedStore
                  && normalizeStoreFilterValue(
                    game.store
                  )
                    !== normalizeStoreFilterValue(
                      selectedStore
                    )
                ) {
                  return false;
                }


                if (
                  specialFilter ===
                  "unanalyzed"
                  && getGameInsight(
                    game
                  )
                ) {
                  return false;
                }

                if (
                  specialFilter ===
                  "needs-installation-attention"
                ) {
                  const health =
                    getBatchHealthResult(
                      game
                    );

                  if (
                    !health
                    || ![
                      "Needs Attention",
                      "Incomplete",
                    ].includes(
                      health.state
                    )
                  ) {
                    return false;
                  }
                }


                const hasCapabilityFilters =
                  includedCapabilities.length > 0
                  || excludedCapabilities.length > 0;

                if (
                  hasCapabilityFilters
                ) {
                  const insight =
                    getGameInsight(
                      game
                    );

                  /*
                   * Capability filters intentionally operate on analyzed
                   * games only. This prevents an unanalyzed game from
                   * incorrectly matching a negative filter such as "No HDR".
                   */
                  if (!insight) {
                    return false;
                  }

                  if (
                    includedCapabilities.length > 0
                  ) {
                    const includeMatches =
                      includedCapabilities.map(
                        (capabilityId) =>
                          insightMatchesFilter(
                            insight,
                            capabilityId
                          )
                      );

                    const includePassed =
                      capabilityMatchMode === "any"
                        ? includeMatches.some(
                            Boolean
                          )
                        : includeMatches.every(
                            Boolean
                          );

                    if (!includePassed) {
                      return false;
                    }
                  }

                  const excludedMatch =
                    excludedCapabilities.some(
                      (capabilityId) =>
                        insightMatchesFilter(
                          insight,
                          capabilityId
                        )
                    );

                  if (excludedMatch) {
                    return false;
                  }
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
              === "name-desc"
            ) {
              return String(
                right.name
                ?? ""
              ).localeCompare(
                String(
                  left.name
                  ?? ""
                ),
                undefined,
                {
                  sensitivity:
                    "base",
                }
              );
            }

            if (
              sortMode
              === "analyzed-first"
              || sortMode
                === "unanalyzed-first"
            ) {
              const leftAnalyzed =
                Boolean(
                  getGameInsight(
                    left
                  )
                );

              const rightAnalyzed =
                Boolean(
                  getGameInsight(
                    right
                  )
                );

              if (
                leftAnalyzed
                !== rightAnalyzed
              ) {
                const analyzedDifference =
                  Number(
                    rightAnalyzed
                  )
                  - Number(
                      leftAnalyzed
                    );

                return sortMode
                  === "analyzed-first"
                    ? analyzedDifference
                    : -analyzedDifference;
              }
            }

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
        selectedStore,
        specialFilter,
        includedCapabilities,
        excludedCapabilities,
        capabilityMatchMode,
        sortMode,
        metadataRevision,
      ]
    );


  const hasCapabilityFilters =
    includedCapabilities.length > 0
    || excludedCapabilities.length > 0;

  const hasActiveFilters =
    favoritesOnly
    || Boolean(
      selectedTag
    )
    || Boolean(
      selectedStore
    )
    || Boolean(
      specialFilter
    )
    || hasCapabilityFilters
    || sortMode
      !== "name";


  function cycleCapability(
    capabilityId
  ) {
    const currentState =
      capabilityState(
        capabilityId,
        includedCapabilities,
        excludedCapabilities
      );

    if (
      currentState === "off"
    ) {
      setIncludedCapabilities(
        (current) => [
          ...current,
          capabilityId,
        ]
      );

      return;
    }

    if (
      currentState === "include"
    ) {
      setIncludedCapabilities(
        (current) =>
          current.filter(
            (item) =>
              item !== capabilityId
          )
      );

      setExcludedCapabilities(
        (current) => [
          ...current.filter(
            (item) =>
              item !== capabilityId
          ),
          capabilityId,
        ]
      );

      return;
    }

    setExcludedCapabilities(
      (current) =>
        current.filter(
          (item) =>
            item !== capabilityId
        )
    );
  }


  function currentFilterSnapshot() {
    return {
      favoritesOnly,

      selectedTag,

      selectedStore,

      specialFilter,

      includedCapabilities:
        [
          ...includedCapabilities,
        ],

      excludedCapabilities:
        [
          ...excludedCapabilities,
        ],

      capabilityMatchMode,

      sortMode,
    };
  }


  function applySavedView(
    view
  ) {
    const filters =
      view?.filters
      ?? {};

    setFavoritesOnly(
      Boolean(
        filters.favoritesOnly
      )
    );

    setSelectedTag(
      typeof filters.selectedTag
        === "string"
        ? filters.selectedTag
        : ""
    );

    setSelectedStore(
      typeof filters.selectedStore
        === "string"
        ? filters.selectedStore
        : ""
    );

    setSpecialFilter(
      [
        "",
        "needs-installation-attention",
        "unanalyzed",
      ].includes(
        filters.specialFilter
      )
        ? filters.specialFilter
        : ""
    );

    setIncludedCapabilities(
      normalizeCapabilityList(
        filters.includedCapabilities
      )
    );

    setExcludedCapabilities(
      normalizeCapabilityList(
        filters.excludedCapabilities
      )
    );

    setCapabilityMatchMode(
      filters.capabilityMatchMode
        === "any"
        ? "any"
        : "all"
    );

    setSortMode(
      [
        "name",
        "name-desc",
        "analyzed-first",
        "unanalyzed-first",
        "favorites",
        "store",
      ].includes(
        filters.sortMode
      )
        ? filters.sortMode
        : "name"
    );

    setActiveSavedViewId(
      view.id
    );

    setSavedViewMessage(
      `Applied "${view.name}".`
    );
  }


  function createSavedView() {
    const name =
      savedViewName
        .trim();

    if (!name) {
      setSavedViewMessage(
        "Enter a name before saving this view."
      );

      return;
    }

    const existing =
      savedViews.find(
        (view) =>
          view.name
            .toLocaleLowerCase()
          === name
            .toLocaleLowerCase()
      );

    if (existing) {
      const updated =
        savedViews.map(
          (view) =>
            view.id === existing.id
              ? {
                  ...view,

                  name,

                  filters:
                    currentFilterSnapshot(),

                  updatedAt:
                    new Date()
                      .toISOString(),
                }
              : view
        );

      setSavedViews(
        updated
      );

      saveSavedViews(
        updated
      );

      setActiveSavedViewId(
        existing.id
      );

      setSavedViewMessage(
        `Updated "${name}".`
      );

      setSavedViewName(
        ""
      );

      return;
    }

    const now =
      new Date()
        .toISOString();

    const nextView = {
      id:
        makeSavedViewId(),

      name,

      createdAt:
        now,

      updatedAt:
        now,

      filters:
        currentFilterSnapshot(),
    };

    const updated = [
      ...savedViews,
      nextView,
    ];

    setSavedViews(
      updated
    );

    saveSavedViews(
      updated
    );

    setActiveSavedViewId(
      nextView.id
    );

    setSavedViewMessage(
      `Saved "${name}".`
    );

    setSavedViewName(
      ""
    );
  }


  function updateActiveSavedView() {
    if (!activeSavedViewId) {
      return;
    }

    const activeView =
      savedViews.find(
        (view) =>
          view.id ===
          activeSavedViewId
      );

    if (!activeView) {
      return;
    }

    const updated =
      savedViews.map(
        (view) =>
          view.id === activeSavedViewId
            ? {
                ...view,

                filters:
                  currentFilterSnapshot(),

                updatedAt:
                  new Date()
                    .toISOString(),
              }
            : view
      );

    setSavedViews(
      updated
    );

    saveSavedViews(
      updated
    );

    setSavedViewMessage(
      `Updated "${activeView.name}".`
    );
  }


  function deleteSavedView(
    viewId
  ) {
    const view =
      savedViews.find(
        (item) =>
          item.id === viewId
      );

    const updated =
      savedViews.filter(
        (item) =>
          item.id !== viewId
      );

    setSavedViews(
      updated
    );

    saveSavedViews(
      updated
    );

    if (
      activeSavedViewId ===
      viewId
    ) {
      setActiveSavedViewId(
        null
      );
    }

    setSavedViewMessage(
      view
        ? `Deleted "${view.name}".`
        : "Saved view deleted."
    );
  }



  function applyBuiltInPreset(
    presetId
  ) {
    setActiveSavedViewId(
      null
    );

    setFavoritesOnly(
      false
    );

    setSelectedTag(
      ""
    );

    setSelectedStore(
      ""
    );

    setSpecialFilter(
      ""
    );

    setIncludedCapabilities(
      []
    );

    setExcludedCapabilities(
      []
    );

    setCapabilityMatchMode(
      "all"
    );

    setSortMode(
      "name"
    );

    switch (presetId) {
      case "hdr":
        setIncludedCapabilities(
          [
            "hdr",
          ]
        );
        break;

      case "ray-tracing":
        setIncludedCapabilities(
          [
            "ray-tracing",
          ]
        );
        break;

      case "frame-generation":
        setIncludedCapabilities(
          [
            "frame-generation",
          ]
        );
        break;

      case "modding-friendly":
        setIncludedCapabilities(
          [
            "renodx",
            "luma",
            "vortex",
            "fluffy",
          ]
        );

        setCapabilityMatchMode(
          "any"
        );
        break;

      case "needs-installation-attention":
        setSpecialFilter(
          "needs-installation-attention"
        );
        break;

      case "ea-app":
        setSelectedStore(
          "ea"
        );
        break;

      case "unanalyzed":
        setSpecialFilter(
          "unanalyzed"
        );

        setSortMode(
          "name"
        );
        break;

      default:
        break;
    }

    setSavedViewMessage(
      presetId ===
        "needs-installation-attention"
        ? "Applied built-in preset. Run Installation Health first if no games appear."
        : "Applied built-in preset."
    );
  }


  function resetFilters() {
    setActiveSavedViewId(
      null
    );

    setFavoritesOnly(
      false
    );

    setSelectedTag(
      ""
    );

    setSelectedStore(
      ""
    );

    setSpecialFilter(
      ""
    );

    setIncludedCapabilities(
      []
    );

    setExcludedCapabilities(
      []
    );

    setCapabilityMatchMode(
      "all"
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
          min-h-0
          max-h-[68vh]
          shrink-0
          overflow-y-auto
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
              GameAtlas
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
          title="Open GameAtlas settings"
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
                grid-cols-1
                gap-2
                sm:grid-cols-3
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
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  Store
                </div>

                <select
                  value={
                    selectedStore
                  }
                  onChange={
                    (event) =>
                      setSelectedStore(
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
                    All Stores
                  </option>

                  <option value="steam">
                    Steam
                  </option>

                  <option value="epic">
                    Epic Games
                  </option>

                  <option value="ea">
                    EA App
                  </option>

                  <option value="gog">
                    GOG Galaxy
                  </option>

                  <option value="ubisoft">
                    Ubisoft
                  </option>

                  <option value="xbox">
                    Xbox / Microsoft Store
                  </option>
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
                    Name A–Z
                  </option>

                  <option value="name-desc">
                    Name Z–A
                  </option>

                  <option value="favorites">
                    Favorites First
                  </option>

                  <option value="store">
                    Store
                  </option>

                  <option value="analyzed-first">
                    Analyzed First
                  </option>

                  <option value="unanalyzed-first">
                    Unanalyzed First
                  </option>
                </select>
              </label>
            </div>

            <div
              className="
                mt-3
                border-t
                border-white/[0.06]
                pt-2.5
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/25
                "
              >
                <Sparkles
                  className="
                    h-3
                    w-3
                  "
                />

                Built-in Presets
              </div>

              <div
                className="
                  mt-2
                  grid
                  grid-cols-2
                  gap-1.5
                "
              >
                {[
                  ["hdr", "HDR Games"],
                  ["ray-tracing", "Ray Tracing"],
                  ["frame-generation", "Frame Generation"],
                  ["modding-friendly", "Modding Friendly"],
                  ["needs-installation-attention", "Needs Install Attention"],
                  ["ea-app", "EA App Games"],
                  ["unanalyzed", "Unanalyzed Games"],
                ].map(
                  ([
                    presetId,
                    label,
                  ]) => (
                    <button
                      key={
                        presetId
                      }
                      type="button"
                      onClick={
                        () =>
                          applyBuiltInPreset(
                            presetId
                          )
                      }
                      className="
                        rounded-lg
                        border
                        border-white/[0.07]
                        bg-white/[0.02]
                        px-2
                        py-1.5
                        text-left
                        text-[10px]
                        font-semibold
                        text-white/40
                        transition
                        hover:border-cyan-500/20
                        hover:bg-cyan-500/[0.05]
                        hover:text-cyan-100/70
                      "
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              <div
                className="
                  mt-1.5
                  text-[9px]
                  leading-relaxed
                  text-white/18
                "
              >
                Presets apply instantly and can be saved as a normal Saved View.
              </div>
            </div>

            <div
              className="
                mt-3
                border-t
                border-white/[0.06]
                pt-2.5
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/25
                "
              >
                <Bookmark
                  className="
                    h-3
                    w-3
                  "
                />

                Saved Views
              </div>

              <div
                className="
                  mt-2
                  flex
                  gap-2
                "
              >
                <input
                  type="text"
                  value={
                    savedViewName
                  }
                  onChange={
                    (event) =>
                      setSavedViewName(
                        event.target.value
                      )
                  }
                  onKeyDown={
                    (event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        createSavedView();
                      }
                    }
                  }
                  placeholder="Name this view…"
                  className="
                    min-w-0
                    flex-1
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-[#111823]
                    px-2.5
                    py-1.5
                    text-[11px]
                    text-white/65
                    outline-none
                    placeholder:text-white/20
                    focus:border-cyan-500/25
                  "
                />

                <button
                  type="button"
                  onClick={
                    createSavedView
                  }
                  className="
                    inline-flex
                    shrink-0
                    items-center
                    gap-1
                    rounded-lg
                    border
                    border-cyan-500/20
                    bg-cyan-500/[0.06]
                    px-2.5
                    py-1.5
                    text-[10px]
                    font-semibold
                    text-cyan-200/70
                    transition
                    hover:bg-cyan-500/[0.10]
                    hover:text-cyan-100
                  "
                >
                  <Save
                    className="
                      h-3
                      w-3
                    "
                  />

                  Save
                </button>
              </div>

              {savedViews.length > 0 ? (
                <div
                  className="
                    mt-2
                    space-y-1.5
                  "
                >
                  {savedViews.map(
                    (view) => (
                      <div
                        key={
                          view.id
                        }
                        className={`
                          flex
                          items-center
                          gap-1.5
                          rounded-lg
                          border
                          px-2
                          py-1.5
                          ${
                            activeSavedViewId ===
                            view.id
                              ? "border-cyan-500/20 bg-cyan-500/[0.05]"
                              : "border-white/[0.06] bg-white/[0.015]"
                          }
                        `}
                      >
                        <button
                          type="button"
                          onClick={
                            () =>
                              applySavedView(
                                view
                              )
                          }
                          className="
                            min-w-0
                            flex-1
                            truncate
                            text-left
                            text-[10px]
                            font-semibold
                            text-white/45
                            transition
                            hover:text-white/70
                          "
                          title={
                            `Apply ${view.name}`
                          }
                        >
                          {view.name}
                        </button>

                        {activeSavedViewId ===
                          view.id ? (
                          <button
                            type="button"
                            onClick={
                              updateActiveSavedView
                            }
                            className="
                              inline-flex
                              h-6
                              w-6
                              shrink-0
                              items-center
                              justify-center
                              rounded-md
                              text-cyan-200/45
                              transition
                              hover:bg-cyan-500/[0.08]
                              hover:text-cyan-100/75
                            "
                            title="Update this saved view with the current filters"
                          >
                            <Save
                              className="
                                h-3
                                w-3
                              "
                            />
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={
                            () =>
                              deleteSavedView(
                                view.id
                              )
                          }
                          className="
                            inline-flex
                            h-6
                            w-6
                            shrink-0
                            items-center
                            justify-center
                            rounded-md
                            text-white/20
                            transition
                            hover:bg-red-500/[0.08]
                            hover:text-red-200/65
                          "
                          title={
                            `Delete ${view.name}`
                          }
                        >
                          <Trash2
                            className="
                              h-3
                              w-3
                            "
                          />
                        </button>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div
                  className="
                    mt-2
                    text-[9px]
                    leading-relaxed
                    text-white/18
                  "
                >
                  Save the current Favorites, Tag, Sort, and capability-filter combination for one-click reuse.
                </div>
              )}

              {savedViewMessage ? (
                <div
                  className="
                    mt-2
                    text-[9px]
                    leading-relaxed
                    text-cyan-200/45
                  "
                >
                  {savedViewMessage}
                </div>
              ) : null}
            </div>


            <div
              className="
                mt-3
                border-t
                border-white/[0.06]
                pt-2.5
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
                <div>
                  <div
                    className="
                      text-[9px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-white/25
                    "
                  >
                    Capabilities
                  </div>

                  <div
                    className="
                      mt-0.5
                      text-[9px]
                      text-white/18
                    "
                  >
                    {analyzedCount} analyzed
                  </div>
                </div>

                <div
                  className="
                    inline-flex
                    rounded-lg
                    border
                    border-white/[0.07]
                    bg-black/10
                    p-0.5
                  "
                  title="How required capability filters are combined"
                >
                  <button
                    type="button"
                    onClick={
                      () =>
                        setCapabilityMatchMode(
                          "all"
                        )
                    }
                    className={`
                      rounded-md
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      transition
                      ${
                        capabilityMatchMode === "all"
                          ? "bg-cyan-500/10 text-cyan-200"
                          : "text-white/25 hover:text-white/50"
                      }
                    `}
                  >
                    ALL
                  </button>

                  <button
                    type="button"
                    onClick={
                      () =>
                        setCapabilityMatchMode(
                          "any"
                        )
                    }
                    className={`
                      rounded-md
                      px-2
                      py-1
                      text-[9px]
                      font-semibold
                      transition
                      ${
                        capabilityMatchMode === "any"
                          ? "bg-cyan-500/10 text-cyan-200"
                          : "text-white/25 hover:text-white/50"
                      }
                    `}
                  >
                    ANY
                  </button>
                </div>
              </div>

              <div
                className="
                  mt-2
                  text-[9px]
                  leading-relaxed
                  text-white/22
                "
              >
                Click once to require (+), twice to exclude (−), and a third time to clear.
              </div>

              {[
                "Graphics",
                "Mods",
              ].map(
                (group) => (
                  <div
                    key={
                      group
                    }
                    className="
                      mt-2.5
                    "
                  >
                    <div
                      className="
                        mb-1.5
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-wide
                        text-white/20
                      "
                    >
                      {group === "Mods"
                        ? "Mods & Enhancements"
                        : group}
                    </div>

                    <div
                      className="
                        flex
                        flex-wrap
                        gap-1.5
                      "
                    >
                      {CAPABILITY_FILTERS
                        .filter(
                          (capability) =>
                            capability.group ===
                            group
                        )
                        .map(
                          (capability) => (
                            <CapabilityChip
                              key={
                                capability.id
                              }
                              capability={
                                capability
                              }
                              state={
                                capabilityState(
                                  capability.id,
                                  includedCapabilities,
                                  excludedCapabilities
                                )
                              }
                              onCycle={
                                cycleCapability
                              }
                            />
                          )
                        )}
                    </div>
                  </div>
                )
              )}

              {hasCapabilityFilters ? (
                <div
                  className="
                    mt-2.5
                    rounded-lg
                    border
                    border-white/[0.06]
                    bg-black/10
                    px-2.5
                    py-2
                    text-[9px]
                    leading-relaxed
                    text-white/30
                  "
                >
                  <span
                    className="
                      font-semibold
                      text-cyan-200/70
                    "
                  >
                    {includedCapabilities.length} required
                  </span>

                  {" · "}

                  <span
                    className="
                      font-semibold
                      text-red-200/65
                    "
                  >
                    {excludedCapabilities.length} excluded
                  </span>

                  {" · "}

                  Analyzed games only.
                </div>
              ) : null}
            </div>
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
                No games found
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  leading-relaxed
                  text-white/25
                "
              >
                Try changing the search
                or clearing Library Filters.
              </div>
            </div>
          ) : (
            <div
              className={
                compactGameRows
                  ? "space-y-0.5"
                  : "space-y-1"
              }
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
