import {
  Activity,
  ArrowRight,
  Clock3,
  History,
  Loader2,
  RefreshCcw,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearLocalInstallationCache,
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  inspectSaveBrowser,
} from "../services/saveBrowser";

import {
  buildChangeSnapshot,
  clearChangeHistory,
  getChangeHistory,
  recordChangeSnapshot,
} from "../services/changeHistory";

import {
  error as logError,
} from "../services/logging";


function formatSize(
  value
) {
  const bytes =
    Number(
      value
      ?? 0
    );

  if (
    !Number.isFinite(
      bytes
    )
    || bytes <= 0
  ) {
    return value === null
      || value === undefined
        ? "None"
        : "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  let size =
    bytes;

  let unit =
    0;

  while (
    size >= 1024
    && unit
      < units.length - 1
  ) {
    size /=
      1024;

    unit +=
      1;
  }

  return `${size.toFixed(
    unit === 0
      ? 0
      : size >= 100
        ? 0
        : size >= 10
          ? 1
          : 2
  )} ${units[unit]}`;
}


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


function formatValue(
  value,
  format
) {
  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return "None";
  }

  if (
    format === "bytes"
  ) {
    return formatSize(
      value
    );
  }

  if (
    format === "boolean"
  ) {
    return value
      ? "Detected"
      : "Not detected";
  }

  if (
    format === "number"
  ) {
    const number =
      Number(
        value
      );

    return Number.isFinite(
      number
    )
      ? number
          .toLocaleString()
      : String(
          value
        );
  }

  if (
    format === "unix"
  ) {
    const number =
      Number(
        value
      );

    return Number.isFinite(
      number
    )
      && number > 0
        ? new Date(
            number * 1000
          )
            .toLocaleString()
        : "None";
  }

  return String(
    value
  );
}


export default function ChangeHistoryPanel({
  game,
}) {
  const [
    history,
    setHistory,
  ] =
    useState(
      () =>
        getChangeHistory(
          game
        )
    );

  const [
    checking,
    setChecking,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState(null);

  const [
    error,
    setError,
  ] =
    useState(null);


  useEffect(
    () => {
      setHistory(
        getChangeHistory(
          game
        )
      );

      setMessage(
        null
      );

      setError(
        null
      );
    },
    [
      game?.id,
      game?.store,
      game?.launcherId,
      game?.name,
    ]
  );


  const totalChanges =
    useMemo(
      () =>
        history.events.reduce(
          (
            total,
            event
          ) =>
            total
            + (
              event.changes
                ?.length
              ?? 0
            ),
          0
        ),
      [
        history,
      ]
    );


  async function checkChanges() {
    if (!game?.installPath) {
      setError(
        "This game does not have an installation path, so GameAtlas cannot create a local change snapshot."
      );

      return;
    }

    setChecking(
      true
    );

    setMessage(
      null
    );

    setError(
      null
    );

    try {
      clearLocalInstallationCache(
        game
      );

      const local =
        await inspectLocalInstallation(
          game,
          {
            force:
              true,
          }
        );

      let saves =
        null;

      if (
        game?.technical
          ?.saveLocation
      ) {
        try {
          saves =
            await inspectSaveBrowser(
              game
            );
        } catch {
          saves =
            null;
        }
      }

      const snapshot =
        buildChangeSnapshot(
          game,
          local,
          saves
        );

      const result =
        recordChangeSnapshot(
          game,
          snapshot
        );

      setHistory({
        baseline:
          result.baseline,

        lastSnapshot:
          result.lastSnapshot,

        events:
          result.events,
      });

      if (
        result.initialized
      ) {
        setMessage(
          "Baseline created. Future checks will compare against this snapshot."
        );
      } else if (
        result.changes.length
          === 0
      ) {
        setMessage(
          "No tracked changes detected."
        );
      } else {
        setMessage(
          `${result.changes.length} change${result.changes.length === 1 ? "" : "s"} detected and added to history.`
        );
      }
    } catch (checkError) {
      logError(
        "[Change History] Check failed:",
        checkError
      );

      setError(
        String(
          checkError
        )
      );
    } finally {
      setChecking(
        false
      );
    }
  }


  function clear() {
    const confirmed =
      window.confirm(
        "Clear all Change History for this game? The next check will create a new baseline."
      );

    if (!confirmed) {
      return;
    }

    clearChangeHistory(
      game
    );

    setHistory({
      baseline:
        null,

      lastSnapshot:
        null,

      events:
        [],
    });

    setMessage(
      "Change History cleared. Run Check for Changes to create a new baseline."
    );

    setError(
      null
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
            Change Events
          </div>

          <div
            className="
              mt-2
              text-2xl
              font-semibold
              text-white/80
            "
          >
            {history.events.length}
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
            Individual Changes
          </div>

          <div
            className="
              mt-2
              text-2xl
              font-semibold
              text-white/80
            "
          >
            {totalChanges}
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
            Last Checked
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
              history
                .lastSnapshot
                ?.capturedAt
            )}
          </div>
        </div>
      </div>


      <div
        className="
          mt-3
          flex
          flex-col
          gap-3
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div>
          <div
            className="
              text-sm
              font-semibold
              text-white/70
            "
          >
            Local Change Detection
          </div>

          <div
            className="
              mt-1
              max-w-3xl
              text-xs
              leading-relaxed
              text-white/30
            "
          >
            Compares the current local installation, graphics technologies, mod evidence, screenshots, and save data against the previous snapshot.
          </div>
        </div>

        <div
          className="
            flex
            shrink-0
            flex-wrap
            gap-2
          "
        >
          {history.lastSnapshot ? (
            <button
              type="button"
              onClick={
                clear
              }
              className="
                inline-flex
                items-center
                gap-2
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

              Clear
            </button>
          ) : null}

          <button
            type="button"
            onClick={
              checkChanges
            }
            disabled={
              checking
              || !game?.installPath
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-cyan-400/25
              bg-cyan-500/10
              px-4
              py-2
              text-xs
              font-semibold
              text-cyan-100/80
              hover:bg-cyan-500/15
              disabled:opacity-30
            "
          >
            {checking ? (
              <Loader2
                className="
                  h-3.5
                  w-3.5
                  animate-spin
                "
              />
            ) : (
              <RefreshCcw
                className="h-3.5 w-3.5"
              />
            )}

            {history.lastSnapshot
              ? "Check for Changes"
              : "Create Baseline"}
          </button>
        </div>
      </div>


      {message ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-emerald-500/15
            bg-emerald-500/[0.04]
            px-3
            py-2.5
            text-xs
            text-emerald-200/60
          "
        >
          {message}
        </div>
      ) : null}


      {error ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-3
            py-2.5
            text-xs
            leading-relaxed
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


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
            gap-2
            border-b
            border-white/[0.07]
            px-4
            py-3
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
            Detected Changes
          </div>
        </div>


        {!history.lastSnapshot ? (
          <div
            className="
              px-4
              py-10
              text-center
            "
          >
            <Activity
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
              No baseline yet
            </div>

            <div
              className="
                mt-1
                text-xs
                text-white/20
              "
            >
              Create a baseline now. The next check can then identify what changed.
            </div>
          </div>
        ) : history.events.length === 0 ? (
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
              Baseline ready
            </div>

            <div
              className="
                mt-1
                text-xs
                text-white/20
              "
            >
              No changes have been recorded yet.
            </div>
          </div>
        ) : (
          <div
            className="
              divide-y
              divide-white/[0.06]
            "
          >
            {history.events.map(
              (
                event
              ) => (
                <div
                  key={
                    event.id
                  }
                  className="
                    p-4
                  "
                >
                  <div
                    className="
                      flex
                      flex-wrap
                      items-center
                      justify-between
                      gap-2
                    "
                  >
                    <div
                      className="
                        text-sm
                        font-semibold
                        text-white/65
                      "
                    >
                      {event.changes.length} change{event.changes.length === 1 ? "" : "s"} detected
                    </div>

                    <div
                      className="
                        text-xs
                        text-white/25
                      "
                    >
                      {formatDate(
                        event.detectedAt
                      )}
                    </div>
                  </div>

                  <div
                    className="
                      mt-3
                      space-y-2
                    "
                  >
                    {event.changes.map(
                      (
                        change
                      ) => (
                        <div
                          key={
                            `${event.id}-${change.key}`
                          }
                          className="
                            rounded-lg
                            border
                            border-white/[0.06]
                            bg-white/[0.015]
                            px-3
                            py-3
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
                              {change.category}
                            </span>

                            <span
                              className="
                                text-xs
                                font-semibold
                                text-white/55
                              "
                            >
                              {change.label}
                            </span>
                          </div>

                          <div
                            className="
                              mt-2
                              grid
                              grid-cols-[1fr_auto_1fr]
                              items-center
                              gap-3
                              text-xs
                            "
                          >
                            <div
                              className="
                                min-w-0
                                break-all
                                rounded-md
                                bg-black/15
                                px-2.5
                                py-2
                                text-white/30
                              "
                            >
                              {formatValue(
                                change.before,
                                change.format
                              )}
                            </div>

                            <ArrowRight
                              className="
                                h-3.5
                                w-3.5
                                shrink-0
                                text-cyan-300/50
                              "
                            />

                            <div
                              className="
                                min-w-0
                                break-all
                                rounded-md
                                bg-cyan-500/[0.04]
                                px-2.5
                                py-2
                                text-cyan-100/60
                              "
                            >
                              {formatValue(
                                change.after,
                                change.format
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>


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
        Change History runs only when you request a check. It reuses GameAtlas's bounded local inspection and Save Browser data rather than continuously monitoring files in the background.
      </div>
    </div>
  );
}
