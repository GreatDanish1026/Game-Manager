import {
  Eye,
  EyeOff,
  Gamepad2,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";


function getStoreLabel(store) {
  if (!store) {
    return "Unknown";
  }

  const normalized =
    store
      .trim()
      .toLowerCase();

  if (normalized === "steam") {
    return "Steam";
  }

  if (
    normalized === "epic" ||
    normalized === "epic games"
  ) {
    return "Epic";
  }

  if (
    normalized === "gog" ||
    normalized === "gog galaxy"
  ) {
    return "GOG";
  }

  if (
    normalized === "ubisoft" ||
    normalized === "ubisoft connect"
  ) {
    return "Ubisoft";
  }

  return store;
}


function GameRow({
  game,
  selected,
  hiddenView,
  onSelect,
  onHide,
  onRestore,
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(game);
      }}
      className={`
        group
        relative
        w-full
        rounded-xl
        border
        px-3
        py-3
        text-left
        transition

        ${
          selected
            ? `
              border-cyan-500/30
              bg-cyan-500/10
            `
            : `
              border-transparent
              bg-transparent
              hover:border-white/[0.06]
              hover:bg-white/[0.04]
            `
        }
      `}
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <div
          className={`
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-lg

            ${
              selected
                ? `
                  bg-cyan-500/15
                  text-cyan-300
                `
                : `
                  bg-white/[0.05]
                  text-white/45
                `
            }
          `}
        >
          <Gamepad2
            className="h-5 w-5"
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
              truncate
              pr-2
              text-sm
              font-medium
              text-white/90
            "
            title={
              game.name
            }
          >
            {game.name}
          </div>

          <div
            className="
              mt-1
              flex
              items-center
              gap-2
            "
          >
            <span
              className="
                rounded
                bg-white/[0.05]
                px-1.5
                py-0.5
                text-[10px]
                font-medium
                uppercase
                tracking-wide
                text-white/40
              "
            >
              {getStoreLabel(
                game.store
              )}
            </span>
          </div>
        </div>

        <button
          type="button"
          title={
            hiddenView
              ? "Restore game"
              : "Hide game"
          }
          onClick={(event) => {
            event.stopPropagation();

            if (hiddenView) {
              onRestore(game);
            } else {
              onHide(game);
            }
          }}
          className={`
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            opacity-60
            transition
            hover:opacity-100

            ${
              hiddenView
                ? `
                  text-emerald-300
                  hover:bg-emerald-500/10
                `
                : `
                  text-white/40
                  hover:bg-white/[0.07]
                  hover:text-white/80
                `
            }
          `}
        >
          {hiddenView ? (
            <RotateCcw
              className="h-4 w-4"
            />
          ) : (
            <EyeOff
              className="h-4 w-4"
            />
          )}
        </button>
      </div>
    </button>
  );
}


export default function Sidebar({
  games,
  totalGames,
  visibleGameCount,
  hiddenGameCount,

  selectedGame,
  onSelectGame,

  search,
  onSearchChange,

  loading,
  scanError,
  onRescan,

  showHiddenGames,
  onShowHiddenGamesChange,

  onHideGame,
  onRestoreGame,
  onRestoreAllHiddenGames,
}) {
  return (
    <aside
      className="
        flex
        h-screen
        w-[330px]
        shrink-0
        flex-col
        border-r
        border-white/[0.07]
        bg-[#0d121b]
      "
    >
      {/* Header */}
      <div
        className="
          border-b
          border-white/[0.07]
          px-4
          pb-4
          pt-5
        "
      >
        <div
          className="
            flex
            items-start
            justify-between
            gap-3
          "
        >
          <div>
            <h1
              className="
                text-lg
                font-semibold
                text-white
              "
            >
              Installed Games
            </h1>

            <div
              className="
                mt-1
                text-xs
                text-white/40
              "
            >
              {showHiddenGames ? (
                <>
                  {hiddenGameCount} hidden
                </>
              ) : (
                <>
                  {visibleGameCount} visible
                  {hiddenGameCount > 0
                    ? ` · ${hiddenGameCount} hidden`
                    : ""}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            title="Rescan installed games"
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
              border-white/10
              bg-white/[0.04]
              text-white/55
              transition
              hover:bg-white/[0.08]
              hover:text-white
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            <RefreshCw
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


        {/* Search */}
        <div
          className="
            relative
            mt-4
          "
        >
          <Search
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              h-4
              w-4
              -translate-y-1/2
              text-white/30
            "
          />

          <input
            type="text"
            value={
              search
            }
            onChange={(event) => {
              onSearchChange(
                event.target.value
              );
            }}
            placeholder={
              showHiddenGames
                ? "Search hidden games..."
                : "Search installed games..."
            }
            className="
              h-10
              w-full
              rounded-lg
              border
              border-white/10
              bg-black/20
              pl-9
              pr-3
              text-sm
              text-white
              outline-none
              transition
              placeholder:text-white/25
              focus:border-cyan-500/40
              focus:bg-black/30
            "
          />
        </div>


        {/* Hidden games toggle */}
        <button
          type="button"
          onClick={() => {
            onShowHiddenGamesChange(
              !showHiddenGames
            );
          }}
          className={`
            mt-3
            flex
            h-10
            w-full
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            text-sm
            font-medium
            transition

            ${
              showHiddenGames
                ? `
                  border-cyan-500/30
                  bg-cyan-500/10
                  text-cyan-300
                `
                : `
                  border-white/10
                  bg-white/[0.03]
                  text-white/55
                  hover:bg-white/[0.07]
                  hover:text-white/80
                `
            }
          `}
        >
          {showHiddenGames ? (
            <>
              <Eye
                className="h-4 w-4"
              />

              Show Visible Games
            </>
          ) : (
            <>
              <EyeOff
                className="h-4 w-4"
              />

              Hidden Games

              {hiddenGameCount > 0 ? (
                <span
                  className="
                    ml-1
                    rounded-full
                    bg-white/[0.08]
                    px-2
                    py-0.5
                    text-xs
                  "
                >
                  {hiddenGameCount}
                </span>
              ) : null}
            </>
          )}
        </button>


        {/* Restore all */}
        {showHiddenGames &&
        hiddenGameCount > 0 ? (
          <button
            type="button"
            onClick={
              onRestoreAllHiddenGames
            }
            className="
              mt-2
              flex
              h-9
              w-full
              items-center
              justify-center
              gap-2
              rounded-lg
              text-xs
              font-medium
              text-emerald-300/80
              transition
              hover:bg-emerald-500/10
              hover:text-emerald-300
            "
          >
            <RotateCcw
              className="h-3.5 w-3.5"
            />

            Restore All Hidden Games
          </button>
        ) : null}
      </div>


      {/* Game list */}
      <div
        className="
          min-h-0
          flex-1
          overflow-y-auto
          p-3
        "
      >
        {loading ? (
          <div
            className="
              flex
              h-32
              flex-col
              items-center
              justify-center
              gap-3
              text-sm
              text-white/40
            "
          >
            <RefreshCw
              className="
                h-5
                w-5
                animate-spin
              "
            />

            Scanning installed games...
          </div>
        ) : scanError ? (
          <div
            className="
              rounded-lg
              border
              border-red-500/20
              bg-red-500/[0.06]
              p-4
            "
          >
            <div
              className="
                text-sm
                font-medium
                text-red-300
              "
            >
              Game scan failed
            </div>

            <div
              className="
                mt-2
                break-words
                text-xs
                leading-relaxed
                text-red-200/50
              "
            >
              {scanError}
            </div>

            <button
              type="button"
              onClick={
                onRescan
              }
              className="
                mt-3
                rounded-lg
                bg-white/[0.06]
                px-3
                py-2
                text-xs
                text-white/70
                hover:bg-white/[0.1]
              "
            >
              Try Again
            </button>
          </div>
        ) : games.length === 0 ? (
          <div
            className="
              flex
              h-48
              flex-col
              items-center
              justify-center
              px-5
              text-center
            "
          >
            {showHiddenGames ? (
              <>
                <Eye
                  className="
                    mb-3
                    h-8
                    w-8
                    text-white/20
                  "
                />

                <div
                  className="
                    text-sm
                    font-medium
                    text-white/60
                  "
                >
                  No hidden games
                </div>

                <div
                  className="
                    mt-1
                    text-xs
                    leading-relaxed
                    text-white/30
                  "
                >
                  Games you hide will
                  appear here so they
                  can be restored later.
                </div>
              </>
            ) : (
              <>
                <Gamepad2
                  className="
                    mb-3
                    h-8
                    w-8
                    text-white/20
                  "
                />

                <div
                  className="
                    text-sm
                    font-medium
                    text-white/60
                  "
                >
                  No games found
                </div>

                <div
                  className="
                    mt-1
                    text-xs
                    leading-relaxed
                    text-white/30
                  "
                >
                  Try changing your search
                  or rescan your installed
                  game libraries.
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            className="
              space-y-1
            "
          >
            {games.map(
              (game) => (
                <GameRow
                  key={
                    `${game.store}-${game.launcherId ?? game.id}-${game.installPath}`
                  }

                  game={
                    game
                  }

                  selected={
                    selectedGame?.id ===
                    game.id
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
                />
              )
            )}
          </div>
        )}
      </div>


      {/* Footer */}
      <div
        className="
          border-t
          border-white/[0.07]
          px-4
          py-3
          text-center
          text-[11px]
          text-white/25
        "
      >
        {totalGames} installed
      </div>
    </aside>
  );
}