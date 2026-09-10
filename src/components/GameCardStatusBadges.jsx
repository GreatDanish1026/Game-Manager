import {
  Activity,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Settings2,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  GAME_CARD_STATUS_EVENTS,
  getGameCardStatus,
} from "../services/gameCardStatus";


const STATUS_ICONS = {
  playing:
    PlayCircle,

  completed:
    CheckCircle2,

  on_hold:
    PauseCircle,

  dropped:
    XCircle,

  replay:
    RotateCcw,
};


const STATUS_CLASSES = {
  cyan:
    "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-200/80",

  emerald:
    "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200/80",

  amber:
    "border-amber-400/20 bg-amber-400/[0.08] text-amber-200/80",

  rose:
    "border-rose-400/20 bg-rose-400/[0.08] text-rose-200/80",

  violet:
    "border-violet-400/20 bg-violet-400/[0.08] text-violet-200/80",
};


function Badge({
  icon: Icon,
  children,
  title,
  className = "",
}) {
  return (
    <span
      title={
        title
      }
      className={`
        inline-flex
        shrink-0
        items-center
        gap-1
        rounded-full
        border
        px-1.5
        py-0.5
        text-[9px]
        font-semibold
        leading-4
        ${className}
      `}
    >
      {Icon ? (
        <Icon
          className="
            h-2.5
            w-2.5
            shrink-0
          "
        />
      ) : null}

      {children}
    </span>
  );
}


export default function GameCardStatusBadges({
  game,
  compact = false,
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
            (value) =>
              value + 1
          );

      for (
        const eventName
        of GAME_CARD_STATUS_EVENTS
      ) {
        window.addEventListener(
          eventName,
          refresh
        );
      }

      return () => {
        for (
          const eventName
          of GAME_CARD_STATUS_EVENTS
        ) {
          window.removeEventListener(
            eventName,
            refresh
          );
        }
      };
    },
    []
  );


  const status =
    useMemo(
      () =>
        getGameCardStatus(
          game
        ),
      [
        game?.id,
        game?.store,
        game?.launcherId,
        game?.name,
        revision,
      ]
    );


  const playStatus =
    status.playStatus;

  const StatusIcon =
    playStatus
      ? STATUS_ICONS[
          playStatus.id
        ]
      : null;


  if (compact) {
    if (!playStatus) {
      return null;
    }

    return (
      <span
        title={
          playStatus.label
        }
        className={`
          inline-flex
          h-4
          w-4
          shrink-0
          items-center
          justify-center
          rounded-full
          border
          ${
            STATUS_CLASSES[
              playStatus.tone
            ]
            ?? STATUS_CLASSES.cyan
          }
        `}
      >
        {StatusIcon ? (
          <StatusIcon
            className="
              h-2.5
              w-2.5
            "
          />
        ) : null}
      </span>
    );
  }


  const showDefaultProfile =
    status.defaultProfile
    && !status.defaultProfile
      .isNormal;


  if (
    !playStatus
    && !status.lastLaunch
    && !showDefaultProfile
    && !status.latestChanges
  ) {
    return null;
  }


  return (
    <>
      {playStatus ? (
        <Badge
          icon={
            StatusIcon
          }
          title={
            `Play status: ${playStatus.label}`
          }
          className={
            STATUS_CLASSES[
              playStatus.tone
            ]
            ?? STATUS_CLASSES.cyan
          }
        >
          {playStatus.label}
        </Badge>
      ) : null}


      {status.lastLaunch ? (
        <Badge
          icon={
            Clock3
          }
          title={
            `Last launched ${new Date(
              status.lastLaunch
                .launchedAt
            ).toLocaleString()} using ${status.lastLaunch.profileName}`
          }
          className="
            border-white/[0.08]
            bg-white/[0.025]
            text-white/40
          "
        >
          {status.lastLaunch.relative}
        </Badge>
      ) : null}


      {showDefaultProfile ? (
        <Badge
          icon={
            Settings2
          }
          title={
            `Default launch profile: ${status.defaultProfile.name}`
          }
          className="
            border-sky-400/15
            bg-sky-400/[0.06]
            text-sky-200/65
          "
        >
          {status.defaultProfile.name}
        </Badge>
      ) : null}


      {status.latestChanges ? (
        <Badge
          icon={
            Activity
          }
          title={
            status.latestChanges.detectedAt
              ? `${status.latestChanges.count} change${status.latestChanges.count === 1 ? "" : "s"} detected ${new Date(
                  status.latestChanges.detectedAt
                ).toLocaleString()}`
              : `${status.latestChanges.count} change${status.latestChanges.count === 1 ? "" : "s"} detected`
          }
          className="
            border-fuchsia-400/15
            bg-fuchsia-400/[0.06]
            text-fuchsia-200/65
          "
        >
          {status.latestChanges.count}
          {" "}
          change{
            status.latestChanges.count
              === 1
                ? ""
                : "s"
          }
        </Badge>
      ) : null}
    </>
  );
}
