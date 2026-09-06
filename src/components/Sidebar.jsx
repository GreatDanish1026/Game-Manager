import {
  Gamepad2,
  Library,
  RefreshCw,
  Search,
  Settings,
} from "lucide-react";

import StoreBadge from "./StoreBadge";

export default function Sidebar({
  games,
  totalGames,
  selectedGame,
  onSelectGame,
  search,
  onSearchChange,
  loading,
  scanError,
  onRescan,
}) {
  return (
    <aside
      className="
        flex h-screen w-[300px] min-w-[300px]
        flex-col border-r border-white/[0.06]
        bg-[#0d1016]
      "
    >
      {/* Application branding */}
      <div
        className="
          flex h-[76px] items-center gap-3
          border-b border-white/[0.06]
          px-5
        "
      >
        <div
          className="
            flex h-10 w-10 items-center justify-center
            rounded-xl
            bg-gradient-to-br from-sky-500 to-blue-600
            shadow-lg shadow-blue-950/30
          "
        >
          <Gamepad2
            size={21}
            className="text-white"
          />
        </div>

        <div>
          <div
            className="
              text-[15px] font-bold tracking-tight
              text-white
            "
          >
            Game Manager
          </div>

          <div className="text-[11px] text-gray-500">
            PC Game Library
          </div>
        </div>
      </div>

      {/* Installed Games section */}
      <div className="px-4 pb-3 pt-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Library
              size={15}
              className="text-gray-500"
            />

            <h2
              className="
                text-xs font-semibold uppercase
                tracking-[0.13em] text-gray-400
              "
            >
              Installed Games
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="
                rounded-full bg-white/[0.05]
                px-2 py-0.5 text-[10px]
                text-gray-500
              "
            >
              {totalGames}
            </span>

            <button
              onClick={onRescan}
              disabled={loading}
              title="Rescan installed games"
              className="
                flex h-7 w-7 items-center
                justify-center rounded-md
                text-gray-500 transition
                hover:bg-white/[0.05]
                hover:text-gray-300
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <RefreshCw
                size={14}
                className={
                  loading ? "animate-spin" : ""
                }
              />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={15}
            className="
              absolute left-3 top-1/2
              -translate-y-1/2 text-gray-600
            "
          />

          <input
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="Search games..."
            disabled={loading}
            className="
              h-9 w-full rounded-lg
              border border-white/[0.06]
              bg-black/20
              pl-9 pr-3 text-sm
              text-gray-200
              outline-none transition
              placeholder:text-gray-600
              focus:border-sky-500/40
              focus:bg-black/30
              focus:ring-2
              focus:ring-sky-500/5
              disabled:opacity-50
            "
          />
        </div>
      </div>

      {/* Game library */}
      <div
        className="
          flex-1 overflow-y-auto
          px-2 pb-4
        "
      >
        {/* Loading state */}
        {loading && (
          <div
            className="
              flex flex-col items-center
              justify-center px-4 py-12
              text-center
            "
          >
            <RefreshCw
              size={20}
              className="
                mb-3 animate-spin
                text-sky-400
              "
            />

            <div className="text-sm text-gray-400">
              Scanning installed games...
            </div>

            <div
              className="
                mt-1 text-xs
                text-gray-600
              "
            >
              Checking Steam, Epic, GOG and Ubisoft
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && scanError && (
          <div
            className="
              mx-2 mb-3 rounded-lg
              border border-red-500/10
              bg-red-500/[0.05]
              px-3 py-3
              text-xs leading-5
              text-red-300
            "
          >
            <div>{scanError}</div>

            <button
              onClick={onRescan}
              className="
                mt-3 flex items-center gap-2
                text-xs font-medium
                text-red-200 transition
                hover:text-white
              "
            >
              <RefreshCw size={13} />
              Try Again
            </button>
          </div>
        )}

        {/* Installed games */}
        {!loading &&
          !scanError &&
          games.map((game) => {
            const active =
              selectedGame?.id === game.id;

            return (
              <button
                key={game.id}
                onClick={() => onSelectGame(game)}
                className={`
                  group mb-1 flex w-full items-center
                  gap-3 rounded-lg px-3 py-3
                  text-left transition
                  ${
                    active
                      ? `
                        bg-sky-500/[0.09]
                        text-white
                      `
                      : `
                        text-gray-400
                        hover:bg-white/[0.035]
                        hover:text-gray-200
                      `
                  }
                `}
              >
                {/* Placeholder game artwork */}
                <div
                  className={`
                    flex h-10 w-8 shrink-0
                    items-center justify-center
                    rounded-md border
                    text-xs font-bold
                    ${
                      active
                        ? `
                          border-sky-500/20
                          bg-sky-500/10
                          text-sky-300
                        `
                        : `
                          border-white/[0.06]
                          bg-white/[0.03]
                          text-gray-600
                        `
                    }
                  `}
                >
                  {game.name
                    .split(" ")
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="
                      truncate text-[13px]
                      font-medium
                    "
                  >
                    {game.name}
                  </div>

                  <div className="mt-1">
                    <StoreBadge store={game.store} />
                  </div>
                </div>

                {active && (
                  <div
                    className="
                      h-7 w-[2px]
                      rounded-full bg-sky-400
                    "
                  />
                )}
              </button>
            );
          })}

        {/* Empty state */}
        {!loading &&
          !scanError &&
          games.length === 0 && (
            <div
              className="
                px-4 py-10 text-center
                text-sm text-gray-600
              "
            >
              No installed games found
            </div>
          )}
      </div>

      {/* Footer */}
      <div
        className="
          border-t border-white/[0.06]
          p-3
        "
      >
        <button
          className="
            flex w-full items-center gap-3
            rounded-lg px-3 py-2.5
            text-sm text-gray-500
            transition
            hover:bg-white/[0.035]
            hover:text-gray-300
          "
        >
          <Settings size={17} />
          Settings
        </button>
      </div>
    </aside>
  );
}