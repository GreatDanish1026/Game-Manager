import {
  Clock3,
  History,
  PackageMinus,
  PackagePlus,
  RefreshCw,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getModChangeTimeline,
} from "../services/modChangeTimeline";


function formatDate(
  value
) {
  if (!value) {
    return "Unknown time";
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
    return "Unknown time";
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


function eventAppearance(
  action
) {
  switch (
    action
  ) {
    case "detected":
      return {
        icon:
          PackagePlus,

        dotClass:
          "bg-emerald-400",

        iconClass:
          "text-emerald-300",

        badgeClass:
          "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200/75",

        badge:
          "Detected",
      };

    case "removed":
      return {
        icon:
          PackageMinus,

        dotClass:
          "bg-rose-400",

        iconClass:
          "text-rose-300",

        badgeClass:
          "border-rose-400/20 bg-rose-400/[0.08] text-rose-200/75",

        badge:
          "Removed",
      };

    default:
      return {
        icon:
          RefreshCw,

        dotClass:
          "bg-amber-400",

        iconClass:
          "text-amber-300",

        badgeClass:
          "border-amber-400/20 bg-amber-400/[0.08] text-amber-200/75",

        badge:
          "Changed",
      };
  }
}


export default function ModChangeTimeline({
  game,
}) {
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
            (
              value
            ) =>
              value
              + 1
          );

      window.addEventListener(
        "game-manager-change-history-changed",
        refresh
      );

      return () => {
        window.removeEventListener(
          "game-manager-change-history-changed",
          refresh
        );
      };
    },
    []
  );


  const timeline =
    useMemo(
      () =>
        getModChangeTimeline(
          game
        ),
      [
        game?.id,
        revision,
      ]
    );


  return (
    <div
      className="
        mt-5
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
          flex-col
          gap-2
          sm:flex-row
          sm:items-center
          sm:justify-between
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
            <History
              className="
                h-4
                w-4
                text-fuchsia-300
              "
            />

            Mod Change Timeline
          </div>

          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            Local mod-state changes captured by Change History.
          </div>
        </div>

        {timeline.length > 0 ? (
          <div
            className="
              rounded-full
              border
              border-white/[0.08]
              bg-white/[0.025]
              px-2.5
              py-1
              text-[10px]
              font-semibold
              text-white/40
            "
          >
            {timeline.length}
            {" "}
            event{
              timeline.length
                === 1
                  ? ""
                  : "s"
            }
          </div>
        ) : null}
      </div>


      {timeline.length === 0 ? (
        <div
          className="
            mt-4
            rounded-lg
            border
            border-dashed
            border-white/[0.08]
            px-4
            py-5
            text-center
          "
        >
          <History
            className="
              mx-auto
              h-5
              w-5
              text-white/20
            "
          />

          <div
            className="
              mt-2
              text-sm
              font-medium
              text-white/50
            "
          >
            No mod changes recorded yet
          </div>

          <div
            className="
              mx-auto
              mt-1
              max-w-lg
              text-xs
              leading-relaxed
              text-white/30
            "
          >
            Once Change History captures a difference in ReShade,
            Special K, Vortex, Fluffy Mod Manager, or related mod
            evidence, it will appear here automatically.
          </div>
        </div>
      ) : (
        <div
          className="
            relative
            mt-5
          "
        >
          <div
            className="
              absolute
              bottom-2
              left-[11px]
              top-2
              w-px
              bg-white/[0.07]
            "
          />

          <div
            className="
              space-y-4
            "
          >
            {timeline.map(
              (
                event,
                index
              ) => {
                const appearance =
                  eventAppearance(
                    event.action
                  );

                const EventIcon =
                  appearance.icon;

                return (
                  <div
                    key={
                      event.id
                    }
                    className="
                      relative
                      flex
                      gap-3
                    "
                  >
                    <div
                      className={`
                        relative
                        z-10
                        mt-1
                        flex
                        h-[23px]
                        w-[23px]
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        border
                        border-white/10
                        bg-[#111722]
                        ${appearance.iconClass}
                      `}
                    >
                      <EventIcon
                        className="
                          h-3
                          w-3
                        "
                      />
                    </div>

                    <div
                      className={`
                        min-w-0
                        flex-1
                        rounded-lg
                        border
                        px-3.5
                        py-3
                        ${
                          index === 0
                            ? "border-white/[0.09] bg-white/[0.025]"
                            : "border-white/[0.06] bg-white/[0.012]"
                        }
                      `}
                    >
                      <div
                        className="
                          flex
                          flex-col
                          gap-2
                          sm:flex-row
                          sm:items-start
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
                            <div
                              className="
                                text-sm
                                font-semibold
                                text-white/75
                              "
                            >
                              {event.title}
                            </div>

                            <span
                              className={`
                                rounded-full
                                border
                                px-2
                                py-0.5
                                text-[9px]
                                font-semibold
                                uppercase
                                tracking-wide
                                ${appearance.badgeClass}
                              `}
                            >
                              {appearance.badge}
                            </span>
                          </div>

                          {event.description ? (
                            <div
                              className="
                                mt-1.5
                                break-all
                                text-xs
                                leading-relaxed
                                text-white/35
                              "
                            >
                              {event.description}
                            </div>
                          ) : null}
                        </div>

                        <div
                          className="
                            flex
                            shrink-0
                            items-center
                            gap-1.5
                            text-[10px]
                            text-white/25
                          "
                        >
                          <Clock3
                            className="
                              h-3
                              w-3
                            "
                          />

                          {formatDate(
                            event.detectedAt
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}
