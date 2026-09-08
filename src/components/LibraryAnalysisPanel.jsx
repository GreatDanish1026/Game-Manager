import {
  Ban,
  CheckCircle2,
  LoaderCircle,
  Play,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";


function progressPercent(
  analysis
) {
  if (
    !analysis.total
  ) {
    return analysis.state ===
      "complete"
        ? 100
        : 0;
  }

  return Math.min(
    100,
    Math.round(
      (
        analysis.completed /
        analysis.total
      ) * 100
    )
  );
}


export default function LibraryAnalysisPanel({
  analysis,
  gameCount,
  onStart,
  onCancel,
}) {
  const [
    dismissed,
    setDismissed,
  ] =
    useState(false);

  const running =
    analysis.state ===
      "running" ||
    analysis.state ===
      "cancelling";

  useEffect(
    () => {
      if (running) {
        setDismissed(
          false
        );
      }
    },
    [
      running,
    ]
  );

  if (
    gameCount === 0
  ) {
    return null;
  }

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={
          () =>
            setDismissed(
              false
            )
        }
        className="
          fixed
          bottom-5
          right-5
          z-40
          inline-flex
          items-center
          gap-2
          rounded-lg
          border
          border-white/10
          bg-[#111823]/95
          px-3
          py-2
          text-xs
          font-semibold
          text-white/70
          shadow-xl
          backdrop-blur
          transition
          hover:bg-[#182230]
          hover:text-white
        "
      >
        <RotateCcw
          className="h-3.5 w-3.5"
        />

        Library Analysis
      </button>
    );
  }

  const percent =
    progressPercent(
      analysis
    );

  const remaining =
    Math.max(
      0,
      analysis.total -
      analysis.completed
    );

  return (
    <div
      className="
        fixed
        bottom-5
        right-5
        z-40
        w-[390px]
        max-w-[calc(100vw-2.5rem)]
        rounded-xl
        border
        border-white/10
        bg-[#111823]/95
        p-4
        shadow-2xl
        backdrop-blur
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >
        <div
          className="
            min-w-0
          "
        >
          <div
            className="
              text-sm
              font-semibold
              text-white
            "
          >
            Library Analysis
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/45
            "
          >
            {analysis.state ===
            "idle"
              ? `${gameCount} installed games`
              : analysis.state ===
                  "running"
                ? `${analysis.completed} / ${analysis.total} analyzed`
                : analysis.state ===
                    "cancelling"
                  ? "Finishing active lookups..."
                  : analysis.state ===
                      "cancelled"
                    ? `Cancelled with ${remaining} remaining`
                    : analysis.total ===
                        0
                      ? "Everything was analyzed recently"
                      : `${analysis.completed} / ${analysis.total} analyzed`}
          </div>
        </div>

        <div
          className="
            flex
            shrink-0
            items-center
            gap-2
          "
        >
          {!running ? (
            <button
              type="button"
              onClick={
                onStart
              }
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              rounded-lg
              bg-cyan-500/15
              px-3
              py-2
              text-xs
              font-semibold
              text-cyan-200
              transition
              hover:bg-cyan-500/25
            "
          >
            {analysis.state ===
            "idle" ? (
              <Play
                className="h-3.5 w-3.5"
              />
            ) : (
              <RotateCcw
                className="h-3.5 w-3.5"
              />
            )}

            {analysis.state ===
            "idle"
              ? "Analyze Library"
              : "Analyze Remaining"}
          </button>
        ) : (
          <button
            type="button"
            onClick={
              onCancel
            }
            disabled={
              analysis.state ===
              "cancelling"
            }
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              rounded-lg
              border
              border-red-500/20
              bg-red-500/[0.08]
              px-3
              py-2
              text-xs
              font-semibold
              text-red-200
              transition
              hover:bg-red-500/[0.14]
              disabled:cursor-wait
              disabled:opacity-50
            "
          >
            <Ban
              className="h-3.5 w-3.5"
            />

            {analysis.state ===
            "cancelling"
              ? "Cancelling..."
              : "Cancel"}
          </button>
        )}

          {!running ? (
            <button
              type="button"
              onClick={
                () =>
                  setDismissed(
                    true
                  )
              }
              aria-label="Close library analysis"
              title="Close"
              className="
                inline-flex
                h-9
                w-9
                items-center
                justify-center
                rounded-lg
                border
                border-white/10
                bg-white/[0.035]
                text-white/45
                transition
                hover:bg-white/[0.07]
                hover:text-white/80
              "
            >
              <X
                className="h-4 w-4"
              />
            </button>
          ) : null}
        </div>
      </div>


      {analysis.state !==
      "idle" ? (
        <>
          <div
            className="
              mt-4
              h-2
              overflow-hidden
              rounded-full
              bg-white/[0.06]
            "
          >
            <div
              className="
                h-full
                rounded-full
                bg-cyan-400
                transition-[width]
                duration-300
              "
              style={{
                width:
                  `${percent}%`,
              }}
            />
          </div>

          <div
            className="
              mt-2
              flex
              items-center
              justify-between
              text-[11px]
              text-white/40
            "
          >
            <span>
              {percent}%
            </span>

            <span>
              {analysis.skipped} recently analyzed
            </span>
          </div>
        </>
      ) : null}


      {analysis.activeGames
        ?.length > 0 ? (
        <div
          className="
            mt-3
            space-y-1.5
          "
        >
          {analysis.activeGames.map(
            (game) => (
              <div
                key={
                  game.id
                }
                className="
                  flex
                  items-center
                  gap-2
                  truncate
                  text-xs
                  text-white/60
                "
              >
                <LoaderCircle
                  className="
                    h-3.5
                    w-3.5
                    shrink-0
                    animate-spin
                    text-cyan-300
                  "
                />

                <span
                  className="truncate"
                >
                  {game.name}
                </span>
              </div>
            )
          )}
        </div>
      ) : null}


      {analysis.state !==
      "idle" ? (
        <div
          className="
            mt-3
            grid
            grid-cols-3
            gap-2
          "
        >
          <div
            className="
              rounded-lg
              bg-emerald-500/[0.06]
              px-2.5
              py-2
            "
          >
            <div
              className="
                flex
                items-center
                gap-1.5
                text-[10px]
                uppercase
                tracking-wide
                text-emerald-300/70
              "
            >
              <CheckCircle2
                className="h-3 w-3"
              />
              Complete
            </div>

            <div
              className="
                mt-1
                text-sm
                font-semibold
                text-white/80
              "
            >
              {analysis.succeeded}
            </div>
          </div>

          <div
            className="
              rounded-lg
              bg-amber-500/[0.06]
              px-2.5
              py-2
            "
          >
            <div
              className="
                flex
                items-center
                gap-1.5
                text-[10px]
                uppercase
                tracking-wide
                text-amber-300/70
              "
            >
              <TriangleAlert
                className="h-3 w-3"
              />
              Failed
            </div>

            <div
              className="
                mt-1
                text-sm
                font-semibold
                text-white/80
              "
            >
              {analysis.failed}
            </div>
          </div>

          <div
            className="
              rounded-lg
              bg-white/[0.035]
              px-2.5
              py-2
            "
          >
            <div
              className="
                text-[10px]
                uppercase
                tracking-wide
                text-white/35
              "
            >
              Remaining
            </div>

            <div
              className="
                mt-1
                text-sm
                font-semibold
                text-white/80
              "
            >
              {remaining}
            </div>
          </div>
        </div>
      ) : null}


      {analysis.errors
        ?.length > 0 ? (
        <div
          className="
            mt-3
            max-h-20
            overflow-y-auto
            rounded-lg
            bg-red-500/[0.04]
            px-3
            py-2
            text-[11px]
            text-red-200/65
          "
        >
          {analysis.errors
            .slice(
              -3
            )
            .map(
              (error) => (
                <div
                  key={
                    `${error.id}-${error.message}`
                  }
                  className="truncate"
                  title={
                    error.message
                  }
                >
                  {error.name}:{" "}
                  {error.message}
                </div>
              )
            )}
        </div>
      ) : null}
    </div>
  );
}
