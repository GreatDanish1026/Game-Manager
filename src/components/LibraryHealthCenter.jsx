import {
  Ban,
  CheckCircle2,
  HeartPulse,
  LoaderCircle,
  Play,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getBatchHealthResults,
  isBatchHealthFresh,
  scanGameInstallationHealth,
  summarizeBatchHealth,
} from "../services/installationHealthBatch";


const STATE_ORDER = [
  "Needs Attention",
  "Incomplete",
  "Good",
  "Excellent",
];


function stateClass(
  state
) {
  switch (state) {
    case "Excellent":
      return "text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]";

    case "Good":
      return "text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.06]";

    case "Needs Attention":
      return "text-amber-300 border-amber-500/20 bg-amber-500/[0.06]";

    default:
      return "text-red-300 border-red-500/20 bg-red-500/[0.06]";
  }
}


export default function LibraryHealthCenter({
  games = [],
  onSelectGame = null,
}) {
  const [
    revision,
    setRevision,
  ] =
    useState(0);

  const [
    running,
    setRunning,
  ] =
    useState(false);

  const [
    completed,
    setCompleted,
  ] =
    useState(0);

  const [
    total,
    setTotal,
  ] =
    useState(0);

  const [
    currentName,
    setCurrentName,
  ] =
    useState("");

  const [
    force,
    setForce,
  ] =
    useState(false);

  const [
    selectedState,
    setSelectedState,
  ] =
    useState("");

  const cancelRef =
    useRef(false);


  useEffect(
    () => {
      const refresh =
        () =>
          setRevision(
            (value) =>
              value + 1
          );

      window.addEventListener(
        "game-manager-installation-health-batch-changed",
        refresh
      );

      return () =>
        window.removeEventListener(
          "game-manager-installation-health-batch-changed",
          refresh
        );
    },
    []
  );


  const summary =
    useMemo(
      () =>
        summarizeBatchHealth(
          games
        ),
      [
        games,
        revision,
      ]
    );


  const results =
    useMemo(
      () => {
        const store =
          getBatchHealthResults();

        const installedById =
          new Map(
            games.map(
              (game) => [
                game.id,
                game,
              ]
            )
          );

        return Object.values(
          store
        )
          .filter(
            (result) =>
              installedById.has(
                result.gameId
              )
          )
          .map(
            (result) => ({
              ...result,
              game:
                installedById.get(
                  result.gameId
                ),
            })
          )
          .filter(
            (result) =>
              !selectedState
              || result.state
                === selectedState
          )
          .sort(
            (left, right) => {
              const stateDifference =
                STATE_ORDER.indexOf(
                  left.state
                )
                - STATE_ORDER.indexOf(
                    right.state
                  );

              if (
                stateDifference
                !== 0
              ) {
                return stateDifference;
              }

              return (
                left.score
                - right.score
              );
            }
          );
      },
      [
        games,
        revision,
        selectedState,
      ]
    );


  async function startScan() {
    if (
      running
      || games.length
        === 0
    ) {
      return;
    }

    cancelRef.current =
      false;

    const store =
      getBatchHealthResults();

    const queue =
      games.filter(
        (game) => {
          if (force) {
            return true;
          }

          return !isBatchHealthFresh(
            store[
              game.id
            ]
          );
        }
      );

    setRunning(
      true
    );

    setCompleted(
      0
    );

    setTotal(
      queue.length
    );

    if (
      queue.length ===
      0
    ) {
      setRunning(
        false
      );

      setCurrentName(
        ""
      );

      return;
    }

    for (
      let index = 0;
      index < queue.length;
      index += 1
    ) {
      if (
        cancelRef.current
      ) {
        break;
      }

      const game =
        queue[
          index
        ];

      setCurrentName(
        game.name
        ?? "Unknown Game"
      );

      await scanGameInstallationHealth(
        game
      );

      setCompleted(
        index + 1
      );
    }

    setRunning(
      false
    );

    setCurrentName(
      ""
    );
  }


  function cancelScan() {
    cancelRef.current =
      true;
  }


  function showState(
    state
  ) {
    setSelectedState(
      (current) =>
        current === state
          ? ""
          : state
    );
  }


  const progress =
    total > 0
      ? Math.round(
          (
            completed
            / total
          ) * 100
        )
      : 0;


  return (
    <section
      className="
        rounded-2xl
        border
        border-white/[0.08]
        bg-[#111823]
        p-5
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
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
            "
          >
            <HeartPulse
              className="
                h-5
                w-5
                text-cyan-300
              "
            />

            <h2
              className="
                text-lg
                font-semibold
                text-white/85
              "
            >
              Installation Health Center
            </h2>
          </div>

          <p
            className="
              mt-1
              max-w-2xl
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            Batch-check local install paths and executable detection across the library.
            Existing analysis cache is reused; this scan does not trigger bulk remote lookups.
          </p>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <label
            className="
              flex
              items-center
              gap-2
              text-[11px]
              text-white/40
            "
          >
            <input
              type="checkbox"
              checked={
                force
              }
              onChange={
                (event) =>
                  setForce(
                    event.target
                      .checked
                  )
              }
              disabled={
                running
              }
            />

            Force fresh scan
          </label>

          {running ? (
            <button
              type="button"
              onClick={
                cancelScan
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-red-500/20
                bg-red-500/[0.05]
                px-3
                py-2
                text-xs
                font-semibold
                text-red-200/70
              "
            >
              <Ban
                className="h-3.5 w-3.5"
              />

              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={
                startScan
              }
              disabled={
                games.length ===
                0
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-cyan-500/20
                bg-cyan-500/[0.07]
                px-3
                py-2
                text-xs
                font-semibold
                text-cyan-100/75
                transition
                hover:bg-cyan-500/[0.12]
                disabled:opacity-30
              "
            >
              <Play
                className="h-3.5 w-3.5"
              />

              Scan Installation Health
            </button>
          )}
        </div>
      </div>


      <div
        className="
          mt-5
          grid
          grid-cols-2
          gap-2
          md:grid-cols-5
        "
      >
        {[
          [
            "Assessed",
            summary.assessed,
            "",
          ],
          [
            "Excellent",
            summary.excellent,
            "Excellent",
          ],
          [
            "Good",
            summary.good,
            "Good",
          ],
          [
            "Needs Attention",
            summary.needsAttention,
            "Needs Attention",
          ],
          [
            "Incomplete",
            summary.incomplete,
            "Incomplete",
          ],
        ].map(
          ([
            label,
            value,
            state,
          ]) => (
            <button
              key={
                label
              }
              type="button"
              onClick={
                state
                  ? () =>
                      showState(
                        state
                      )
                  : undefined
              }
              className={`
                rounded-xl
                border
                p-3
                text-left
                ${
                  state
                    ? stateClass(
                        state
                      )
                    : "border-white/[0.07] bg-black/10 text-white/55"
                }
                ${
                  selectedState
                    === state
                    && state
                      ? "ring-1 ring-white/20"
                      : ""
                }
              `}
            >
              <div
                className="
                  text-xl
                  font-bold
                "
              >
                {value}
              </div>

              <div
                className="
                  mt-1
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-wide
                  opacity-60
                "
              >
                {label}
              </div>
            </button>
          )
        )}
      </div>


      <div
        className="
          mt-3
          text-[10px]
          text-white/25
        "
      >
        {summary.assessed} of {summary.total} installed games assessed
        {summary.stale > 0
          ? ` · ${summary.stale} stale`
          : ""}
      </div>


      {running ? (
        <div
          className="
            mt-5
            rounded-xl
            border
            border-cyan-500/15
            bg-cyan-500/[0.04]
            p-4
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              text-xs
            "
          >
            <div
              className="
                flex
                min-w-0
                items-center
                gap-2
                text-white/60
              "
            >
              <LoaderCircle
                className="
                  h-4
                  w-4
                  shrink-0
                  animate-spin
                  text-cyan-300
                "
              />

              <span
                className="truncate"
              >
                {currentName}
              </span>
            </div>

            <span
              className="
                shrink-0
                text-white/35
              "
            >
              {completed} / {total}
            </span>
          </div>

          <div
            className="
              mt-3
              h-1.5
              overflow-hidden
              rounded-full
              bg-white/[0.06]
            "
          >
            <div
              className="
                h-full
                bg-cyan-400/60
                transition-all
              "
              style={{
                width:
                  `${progress}%`,
              }}
            />
          </div>
        </div>
      ) : null}


      {results.length > 0 ? (
        <div
          className="
            mt-5
            overflow-hidden
            rounded-xl
            border
            border-white/[0.07]
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              border-b
              border-white/[0.06]
              bg-black/10
              px-4
              py-3
            "
          >
            <div
              className="
                text-xs
                font-semibold
                text-white/55
              "
            >
              {selectedState
                ? selectedState
                : "Assessed Games"}
            </div>

            {selectedState ? (
              <button
                type="button"
                onClick={
                  () =>
                    setSelectedState(
                      ""
                    )
                }
                className="
                  text-[10px]
                  font-semibold
                  text-cyan-300/60
                  hover:text-cyan-200
                "
              >
                Show All
              </button>
            ) : null}
          </div>

          <div
            className="
              max-h-[360px]
              divide-y
              divide-white/[0.05]
              overflow-y-auto
            "
          >
            {results.map(
              (result) => (
                <div
                  key={
                    result.gameId
                  }
                  className="
                    flex
                    flex-col
                    gap-3
                    px-4
                    py-3
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                  "
                >
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
                          truncate
                          text-sm
                          font-semibold
                          text-white/70
                        "
                      >
                        {result.name}
                      </span>

                      <span
                        className={`
                          rounded-full
                          border
                          px-2
                          py-0.5
                          text-[9px]
                          font-semibold
                          ${stateClass(
                            result.state
                          )}
                        `}
                      >
                        {result.state} · {result.score}
                      </span>
                    </div>

                    <div
                      className="
                        mt-1
                        text-[10px]
                        text-white/28
                      "
                    >
                      {result.executableFound
                        ? "Executable found"
                        : result.installPathPresent
                          ? "Executable not confirmed"
                          : "Install path unavailable"}
                      {result.analyzed
                        ? " · analysis cached"
                        : " · analysis not cached"}
                    </div>

                    {result.nextSteps
                      ?.length > 0 ? (
                      <div
                        className="
                          mt-1.5
                          text-[10px]
                          text-amber-200/45
                        "
                      >
                        {result.nextSteps[0]}
                      </div>
                    ) : null}
                  </div>

                  {onSelectGame
                    && result.game ? (
                    <button
                      type="button"
                      onClick={
                        () =>
                          onSelectGame(
                            result.game
                          )
                      }
                      className="
                        inline-flex
                        shrink-0
                        items-center
                        gap-1.5
                        rounded-lg
                        border
                        border-white/[0.08]
                        bg-white/[0.025]
                        px-2.5
                        py-1.5
                        text-[10px]
                        font-semibold
                        text-white/45
                        hover:bg-white/[0.06]
                        hover:text-white/70
                      "
                    >
                      <RefreshCcw
                        className="h-3 w-3"
                      />

                      Open Game
                    </button>
                  ) : null}
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div
          className="
            mt-5
            rounded-xl
            border
            border-dashed
            border-white/[0.08]
            bg-black/10
            px-4
            py-5
            text-center
            text-xs
            text-white/30
          "
        >
          Run Installation Health to assess the installed library.
        </div>
      )}
    </section>
  );
}
