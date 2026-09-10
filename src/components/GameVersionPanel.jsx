import {
  Clock3,
  History,
  RefreshCw,
  Save,
  Tag,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  checkGameVersion,
  clearGameVersionHistory,
  displayGameVersion,
  getGameVersionState,
  setManualGameVersion,
} from "../services/gameVersions";


function formatDate(
  value
) {
  if (!value) {
    return "Unknown";
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

  return date.toLocaleString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}


function snapshotLabel(
  snapshot
) {
  if (
    snapshot?.productVersion
  ) {
    return snapshot
      .productVersion;
  }

  if (
    snapshot?.fileVersion
  ) {
    return snapshot
      .fileVersion;
  }

  if (
    snapshot?.steamBuildId
  ) {
    return `Build ${snapshot.steamBuildId}`;
  }

  return "Unknown version";
}


export default function GameVersionPanel({
  game,
}) {
  const [
    state,
    setState,
  ] =
    useState(
      () =>
        getGameVersionState(
          game
        )
    );

  const [
    manualDraft,
    setManualDraft,
  ] =
    useState(
      () =>
        getGameVersionState(
          game
        ).manualVersion
    );

  const [
    checking,
    setChecking,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);


  useEffect(
    () => {
      const next =
        getGameVersionState(
          game
        );

      setState(
        next
      );

      setManualDraft(
        next.manualVersion
      );

      setError(
        null
      );
    },
    [
      game?.id,
    ]
  );


  useEffect(
    () => {
      let cancelled =
        false;

      if (!game?.id) {
        return () => {
          cancelled = true;
        };
      }

      setChecking(
        true
      );

      checkGameVersion(
        game
      )
        .then(
          (
            next
          ) => {
            if (!cancelled) {
              setState(
                next
              );
            }
          }
        )
        .catch(
          (
            value
          ) => {
            if (!cancelled) {
              setError(
                String(
                  value
                )
              );
            }
          }
        )
        .finally(
          () => {
            if (!cancelled) {
              setChecking(
                false
              );
            }
          }
        );

      return () => {
        cancelled =
          true;
      };
    },
    [
      game?.id,
      game?.installPath,
      game?.executablePath,
      game?.executable,
      game?.launcherId,
      game?.store,
    ]
  );


  const display =
    useMemo(
      () =>
        displayGameVersion(
          state
        ),
      [
        state,
      ]
    );


  async function handleCheck() {
    setChecking(
      true
    );

    setError(
      null
    );

    try {
      const next =
        await checkGameVersion(
          game
        );

      setState(
        next
      );
    } catch (
      value
    ) {
      setError(
        String(
          value
        )
      );
    } finally {
      setChecking(
        false
      );
    }
  }


  function handleSaveManual() {
    setManualGameVersion(
      game,
      manualDraft
    );

    setState(
      getGameVersionState(
        game
      )
    );
  }


  function handleClearHistory() {
    clearGameVersionHistory(
      game
    );

    setState(
      getGameVersionState(
        game
      )
    );
  }


  return (
    <section
      className="
        mb-5
        rounded-xl
        border
        border-white/[0.08]
        bg-white/[0.02]
        p-4
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          lg:flex-row
          lg:items-start
          lg:justify-between
        "
      >
        <div>
          <div
            className="
              flex
              items-center
              gap-2
              text-sm
              font-semibold
              text-white/80
            "
          >
            <Tag
              className="
                h-4
                w-4
                text-cyan-300
              "
            />

            Game Version
          </div>

          <div
            className="
              mt-2
              flex
              flex-wrap
              items-baseline
              gap-x-3
              gap-y-1
            "
          >
            <div
              className="
                text-xl
                font-bold
                text-white/85
              "
            >
              {display.value}
            </div>

            <div
              className="
                text-xs
                text-white/30
              "
            >
              {display.source}
            </div>
          </div>

          {state.current ? (
            <div
              className="
                mt-2
                flex
                flex-wrap
                gap-x-4
                gap-y-1
                text-[11px]
                text-white/30
              "
            >
              {state.current.steamBuildId ? (
                <span>
                  Steam build:{" "}
                  {state.current.steamBuildId}
                </span>
              ) : null}

              {state.current.productVersion ? (
                <span>
                  Product:{" "}
                  {state.current.productVersion}
                </span>
              ) : null}

              {state.current.fileVersion ? (
                <span>
                  File:{" "}
                  {state.current.fileVersion}
                </span>
              ) : null}

              <span>
                Checked:{" "}
                {formatDate(
                  state.current.checkedAt
                )}
              </span>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={
            handleCheck
          }
          disabled={
            checking
          }
          className="
            inline-flex
            shrink-0
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-cyan-400/20
            bg-cyan-400/[0.07]
            px-3
            py-2
            text-xs
            font-semibold
            text-cyan-100/80
            transition
            hover:bg-cyan-400/[0.11]
            disabled:cursor-not-allowed
            disabled:opacity-45
          "
        >
          <RefreshCw
            className={`
              h-3.5
              w-3.5
              ${
                checking
                  ? "animate-spin"
                  : ""
              }
            `}
          />

          {checking
            ? "Checking…"
            : "Check Version"
          }
        </button>
      </div>


      {error ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-amber-500/15
            bg-amber-500/[0.05]
            px-3
            py-2
            text-xs
            text-amber-200/60
          "
        >
          {error}
        </div>
      ) : null}


      <div
        className="
          mt-4
          grid
          grid-cols-1
          gap-4
          xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]
        "
      >
        <div
          className="
            rounded-lg
            border
            border-white/[0.07]
            bg-black/10
            p-3.5
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
            Manual Version Override
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
                manualDraft
              }
              onChange={
                (
                  event
                ) =>
                  setManualDraft(
                    event.target.value
                  )
              }
              placeholder="e.g. 1.14.2 or Patch 7"
              className="
                min-w-0
                flex-1
                rounded-lg
                border
                border-white/[0.08]
                bg-black/20
                px-3
                py-2
                text-sm
                text-white/75
                outline-none
                placeholder:text-white/20
                focus:border-cyan-400/25
              "
            />

            <button
              type="button"
              onClick={
                handleSaveManual
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-white/[0.08]
                bg-white/[0.03]
                px-3
                py-2
                text-xs
                font-semibold
                text-white/55
                hover:bg-white/[0.06]
                hover:text-white/75
              "
            >
              <Save
                className="
                  h-3.5
                  w-3.5
                "
              />

              Save
            </button>
          </div>

          <div
            className="
              mt-2
              text-[10px]
              leading-relaxed
              text-white/25
            "
          >
            Leave blank to use automatic executable or Steam build metadata.
          </div>
        </div>


        <div
          className="
            rounded-lg
            border
            border-white/[0.07]
            bg-black/10
            p-3.5
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
            <div
              className="
                flex
                items-center
                gap-2
                text-[10px]
                font-semibold
                uppercase
                tracking-wide
                text-white/30
              "
            >
              <History
                className="
                  h-3.5
                  w-3.5
                "
              />

              Version History
            </div>

            {state.history.length > 0 ? (
              <button
                type="button"
                onClick={
                  handleClearHistory
                }
                className="
                  text-[10px]
                  text-white/25
                  hover:text-white/55
                "
              >
                Clear history
              </button>
            ) : null}
          </div>

          {state.history.length === 0 ? (
            <div
              className="
                mt-3
                text-xs
                text-white/25
              "
            >
              No version changes recorded yet.
            </div>
          ) : (
            <div
              className="
                mt-3
                max-h-40
                space-y-2
                overflow-y-auto
                pr-1
              "
            >
              {state.history.map(
                (
                  snapshot,
                  index
                ) => (
                  <div
                    key={
                      `${snapshot.checkedAt}-${index}`
                    }
                    className="
                      flex
                      items-start
                      justify-between
                      gap-3
                      rounded-md
                      border
                      border-white/[0.05]
                      bg-white/[0.015]
                      px-3
                      py-2
                    "
                  >
                    <div
                      className="
                        min-w-0
                      "
                    >
                      <div
                        className="
                          text-xs
                          font-semibold
                          text-white/55
                        "
                      >
                        {snapshotLabel(
                          snapshot
                        )}
                      </div>

                      {snapshot.steamBuildId ? (
                        <div
                          className="
                            mt-0.5
                            text-[10px]
                            text-white/25
                          "
                        >
                          Steam build{" "}
                          {snapshot.steamBuildId}
                        </div>
                      ) : null}
                    </div>

                    <div
                      className="
                        flex
                        shrink-0
                        items-center
                        gap-1
                        text-[10px]
                        text-white/20
                      "
                    >
                      <Clock3
                        className="
                          h-3
                          w-3
                        "
                      />

                      {formatDate(
                        snapshot.checkedAt
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
