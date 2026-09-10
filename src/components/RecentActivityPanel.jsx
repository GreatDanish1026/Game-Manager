import {
  Clock3,
  Gauge,
  History,
  PlayCircle,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearLaunchHistory,
  getLaunchHistory,
} from "../services/recentActivity";


function formatDate(
  value
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString();
}


function profileIcon(
  entry
) {
  const name =
    String(
      entry?.profileName
      ?? ""
    )
      .toLowerCase();

  if (
    name.includes(
      "benchmark"
    )
  ) {
    return Gauge;
  }

  if (
    name.includes(
      "mod"
    )
  ) {
    return Wrench;
  }

  return PlayCircle;
}


function methodLabel(
  entry
) {
  if (
    entry?.launchMode
      === "direct"
  ) {
    return "Direct Executable";
  }

  const method =
    String(
      entry?.method
      ?? ""
    )
      .trim();

  if (!method) {
    return "Standard Launcher";
  }

  return method
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character
          .toUpperCase()
    );
}


export default function RecentActivityPanel({
  game,
}) {
  const [
    history,
    setHistory,
  ] =
    useState(
      () =>
        getLaunchHistory(
          game
        )
    );


  useEffect(
    () => {
      setHistory(
        getLaunchHistory(
          game
        )
      );
    },
    [
      game?.id,
      game?.store,
      game?.launcherId,
      game?.name,
    ]
  );


  useEffect(
    () => {
      function refresh() {
        setHistory(
          getLaunchHistory(
            game
          )
        );
      }

      window.addEventListener(
        "game-manager-launch-history-changed",
        refresh
      );

      return () => {
        window.removeEventListener(
          "game-manager-launch-history-changed",
          refresh
        );
      };
    },
    [
      game?.id,
      game?.store,
      game?.launcherId,
      game?.name,
    ]
  );


  const summary =
    useMemo(
      () => ({
        count:
          history.length,

        lastLaunch:
          history[0]
          ?? null,

        profileCount:
          new Set(
            history.map(
              (
                entry
              ) =>
                entry.profileName
            )
          ).size,
      }),
      [
        history,
      ]
    );


  function clear() {
    const confirmed =
      window.confirm(
        "Clear the GameAtlas launch history for this game?"
      );

    if (!confirmed) {
      return;
    }

    clearLaunchHistory(
      game
    );

    setHistory(
      []
    );
  }


  return (
    <div>
      <div
        className="
          grid
          grid-cols-1
          gap-3
          md:grid-cols-3
        "
      >
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
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            Launches Tracked
          </div>

          <div
            className="
              mt-2
              text-2xl
              font-semibold
              text-white/80
            "
          >
            {summary.count}
          </div>
        </div>


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
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            Last Launched
          </div>

          <div
            className="
              mt-2
              text-sm
              font-semibold
              text-white/70
            "
          >
            {formatDate(
              summary.lastLaunch
                ?.launchedAt
            )}
          </div>
        </div>


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
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            Profiles Used
          </div>

          <div
            className="
              mt-2
              text-2xl
              font-semibold
              text-white/80
            "
          >
            {summary.profileCount}
          </div>
        </div>
      </div>


      <div
        className="
          mt-3
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
            justify-between
            gap-3
            border-b
            border-white/[0.07]
            px-4
            py-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <History
              className="
                h-4
                w-4
                text-cyan-300/70
              "
            />

            <div
              className="
                text-sm
                font-semibold
                text-white/70
              "
            >
              Recent Launches
            </div>
          </div>

          {history.length > 0 ? (
            <button
              type="button"
              onClick={
                clear
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-red-500/15
                bg-red-500/[0.035]
                px-3
                py-2
                text-xs
                font-semibold
                text-red-200/40
                hover:bg-red-500/[0.07]
                hover:text-red-200/65
              "
            >
              <Trash2
                className="h-3.5 w-3.5"
              />

              Clear History
            </button>
          ) : null}
        </div>


        {history.length === 0 ? (
          <div
            className="
              px-4
              py-10
              text-center
            "
          >
            <Clock3
              className="
                mx-auto
                h-7
                w-7
                text-white/15
              "
            />

            <div
              className="
                mt-3
                text-sm
                font-semibold
                text-white/35
              "
            >
              No GameAtlas launches recorded yet
            </div>

            <div
              className="
                mt-1
                text-xs
                text-white/20
              "
            >
              Launch this game from GameAtlas to start building local activity history.
            </div>
          </div>
        ) : (
          <div
            className="
              divide-y
              divide-white/[0.06]
            "
          >
            {history
              .slice(
                0,
                20
              )
              .map(
                (
                  entry
                ) => {
                  const Icon =
                    profileIcon(
                      entry
                    );

                  return (
                    <div
                      key={
                        entry.id
                      }
                      className="
                        flex
                        flex-col
                        gap-3
                        px-4
                        py-3.5
                        md:flex-row
                        md:items-center
                        md:justify-between
                      "
                    >
                      <div
                        className="
                          flex
                          min-w-0
                          items-center
                          gap-3
                        "
                      >
                        <div
                          className="
                            flex
                            h-9
                            w-9
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-cyan-500/10
                            text-cyan-300/70
                          "
                        >
                          <Icon
                            className="h-4 w-4"
                          />
                        </div>

                        <div
                          className="
                            min-w-0
                          "
                        >
                          <div
                            className="
                              flex
                              flex-wrap
                              items-center
                              gap-2
                            "
                          >
                            <span
                              className="
                                text-sm
                                font-semibold
                                text-white/65
                              "
                            >
                              {entry.profileName}
                            </span>

                            <span
                              className="
                                rounded-full
                                border
                                border-white/[0.07]
                                bg-white/[0.02]
                                px-2
                                py-0.5
                                text-[9px]
                                font-semibold
                                uppercase
                                tracking-wide
                                text-white/25
                              "
                            >
                              {methodLabel(
                                entry
                              )}
                            </span>
                          </div>

                          {entry.executablePath ? (
                            <div
                              className="
                                mt-1
                                truncate
                                font-mono
                                text-[10px]
                                text-white/20
                              "
                            >
                              {entry.executablePath}
                            </div>
                          ) : (
                            <div
                              className="
                                mt-1
                                text-[10px]
                                text-white/20
                              "
                            >
                              {entry.store || game.store || "Launcher"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div
                        className="
                          shrink-0
                          text-xs
                          text-white/30
                        "
                      >
                        {formatDate(
                          entry.launchedAt
                        )}
                      </div>
                    </div>
                  );
                }
              )}
          </div>
        )}
      </div>


      {history.length > 20 ? (
        <div
          className="
            mt-2
            text-right
            text-[10px]
            text-white/20
          "
        >
          Showing the 20 most recent of {history.length} tracked launches.
        </div>
      ) : null}


      <div
        className="
          mt-3
          rounded-lg
          border
          border-white/[0.06]
          bg-white/[0.015]
          px-3
          py-3
          text-[10px]
          leading-relaxed
          text-white/22
        "
      >
        This is local GameAtlas launch history, not launcher-reported playtime. A successful launch request is recorded when GameAtlas sends the game or selected launch profile to Windows / its launcher.
      </div>
    </div>
  );
}
