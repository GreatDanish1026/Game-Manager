import {
  Activity,
  Gamepad2,
  MonitorUp,
  Puzzle,
  Star,
  Store,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getLibraryInsights,
  getLibrarySnapshot,
} from "../services/libraryInsights";

import {
  getGameUserMetadata,
} from "../services/userGameMetadata";

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
        p-4
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
          text-xs
          font-semibold
          uppercase
          tracking-wide
          text-white/30
        "
      >
        <Icon
          className="
            h-4
            w-4
            text-cyan-300/70
          "
        />

        {label}
      </div>

      <div
        className="
          mt-3
          text-2xl
          font-bold
          text-white/78
        "
      >
        {value}
      </div>

      {detail ? (
        <div
          className="
            mt-1
            text-xs
            text-white/25
          "
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function CountRow({
  label,
  value,
}) {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        border-b
        border-white/[0.055]
        px-4
        py-2.5
        last:border-b-0
      "
    >
      <span
        className="
          text-sm
          text-white/45
        "
      >
        {label}
      </span>

      <span
        className="
          text-sm
          font-semibold
          tabular-nums
          text-white/70
        "
      >
        {value}
      </span>
    </div>
  );
}

export default function LibraryDashboard() {
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
        "game-manager-library-insights-changed",
        "game-manager-library-snapshot-changed",
        "game-manager-user-metadata-changed",
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

        const games =
          Object.values(
            snapshot.games
            ?? {}
          );

        const insights =
          Object.values(
            getLibraryInsights()
          );

        const stores =
          games.reduce(
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

        return {
          total:
            snapshot.totalGames
            || games.length,

          indexed:
            games.length,

          analyzed:
            insights.length,

          favorites:
            games.filter(
              (game) =>
                getGameUserMetadata(
                  game
                ).favorite
            ).length,

          stores,

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
        revision,
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

  return (
    <main
      className="
        min-w-0
        flex-1
        overflow-y-auto
        bg-[#0b0f17]
      "
    >
      <div
        className="
          mx-auto
          max-w-6xl
          px-6
          py-8
          lg:px-10
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-cyan-500/10
              text-cyan-300
            "
          >
            <Gamepad2
              className="h-6 w-6"
            />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-semibold
                text-white
              "
            >
              Library Overview
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-white/35
              "
            >
              Select a game from the sidebar, or review what Game Manager has learned about your library.
            </p>
          </div>
        </div>

        <div
          className="
            mt-7
            grid
            grid-cols-2
            gap-3
            lg:grid-cols-4
          "
        >
          <StatCard
            icon={
              Gamepad2
            }
            label="Installed"
            value={
              data.total
            }
            detail={`${data.indexed} currently indexed`}
          />

          <StatCard
            icon={
              Activity
            }
            label="Analyzed"
            value={
              data.analyzed
            }
            detail="Opened and enriched games"
          />

          <StatCard
            icon={
              Star
            }
            label="Favorites"
            value={
              data.favorites
            }
          />

          <StatCard
            icon={
              Store
            }
            label="Stores"
            value={
              storeRows.length
            }
          />
        </div>

        <div
          className="
            mt-6
            grid
            grid-cols-1
            gap-4
            xl:grid-cols-3
          "
        >
          <div
            className="
              overflow-hidden
              rounded-xl
              border
              border-white/[0.08]
              bg-black/10
            "
          >
            <div
              className="
                border-b
                border-white/[0.06]
                px-4
                py-3.5
                text-sm
                font-semibold
                text-white/70
              "
            >
              Storefronts
            </div>

            {storeRows.map(
              (
                [
                  store,
                  count,
                ]
              ) => (
                <CountRow
                  key={
                    store
                  }
                  label={
                    store
                  }
                  value={
                    count
                  }
                />
              )
            )}
          </div>

          <div
            className="
              overflow-hidden
              rounded-xl
              border
              border-white/[0.08]
              bg-black/10
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                border-b
                border-white/[0.06]
                px-4
                py-3.5
                text-sm
                font-semibold
                text-white/70
              "
            >
              <MonitorUp
                className="
                  h-4
                  w-4
                  text-cyan-300/70
                "
              />

              Graphics
            </div>

            <CountRow
              label="HDR"
              value={
                data.hdr
              }
            />

            <CountRow
              label="Ray Tracing"
              value={
                data.rayTracing
              }
            />

            <CountRow
              label="Frame Generation"
              value={
                data.frameGeneration
              }
            />

            <CountRow
              label="Ultrawide"
              value={
                data.ultrawide
              }
            />
          </div>

          <div
            className="
              overflow-hidden
              rounded-xl
              border
              border-white/[0.08]
              bg-black/10
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
                border-b
                border-white/[0.06]
                px-4
                py-3.5
                text-sm
                font-semibold
                text-white/70
              "
            >
              <Puzzle
                className="
                  h-4
                  w-4
                  text-cyan-300/70
                "
              />

              Mods & Enhancements
            </div>

            <CountRow
              label="RenoDX"
              value={
                data.renodx
              }
            />

            <CountRow
              label="Luma"
              value={
                data.luma
              }
            />

            <CountRow
              label="Vortex"
              value={
                data.vortex
              }
            />

            <CountRow
              label="Fluffy"
              value={
                data.fluffy
              }
            />
          </div>
        </div>

        <div
          className="
            mt-5
            rounded-xl
            border
            border-cyan-500/10
            bg-cyan-500/[0.025]
            p-4
            text-xs
            leading-relaxed
            text-white/30
          "
        >
          Graphics and mod counts are based on games you have opened and analyzed.
          This avoids sending hundreds of automatic requests to external services at startup.
        </div>
      </div>
    </main>
  );
}
