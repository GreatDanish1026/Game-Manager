import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  LoaderCircle,
  RefreshCcw,
  TriangleAlert,
  WifiOff,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getServiceStatuses,
  SERVICE_LABELS,
} from "../services/serviceStatus";


function relativeTime(
  timestamp
) {
  if (!timestamp) {
    return "Never checked";
  }

  const seconds =
    Math.max(
      0,
      Math.floor(
        (
          Date.now() -
          timestamp
        ) / 1000
      )
    );

  if (seconds < 60) {
    return "Just now";
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days =
    Math.floor(
      hours / 24
    );

  return `${days}d ago`;
}


function statusPresentation(
  status
) {
  switch (
    status
  ) {
    case "online":
      return {
        label:
          "Online",

        icon:
          CheckCircle2,

        classes:
          "border-emerald-500/15 bg-emerald-500/[0.055] text-emerald-300",
      };

    case "degraded":
      return {
        label:
          "Degraded",

        icon:
          TriangleAlert,

        classes:
          "border-amber-500/15 bg-amber-500/[0.055] text-amber-300",
      };

    case "offline":
      return {
        label:
          "Unavailable",

        icon:
          WifiOff,

        classes:
          "border-red-500/15 bg-red-500/[0.055] text-red-300",
      };

    case "checking":
      return {
        label:
          "Checking",

        icon:
          LoaderCircle,

        classes:
          "border-cyan-500/15 bg-cyan-500/[0.055] text-cyan-300",
      };

    default:
      return {
        label:
          "Unknown",

        icon:
          CircleHelp,

        classes:
          "border-white/[0.08] bg-white/[0.025] text-white/40",
      };
  }
}


function ServiceRow({
  serviceId,
  record,
}) {
  const presentation =
    statusPresentation(
      record.status
    );

  const Icon =
    presentation.icon;

  return (
    <div
      className="
        flex
        flex-col
        gap-3
        border-b
        border-white/[0.055]
        px-4
        py-3.5
        last:border-b-0
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
            text-sm
            font-semibold
            text-white/70
          "
        >
          {
            SERVICE_LABELS[
              serviceId
            ]
          }
        </div>

        <div
          className="
            mt-1
            truncate
            text-[11px]
            text-white/30
          "
          title={
            record.message
          }
        >
          {record.message}
        </div>
      </div>

      <div
        className="
          flex
          shrink-0
          items-center
          gap-3
        "
      >
        <div
          className="
            flex
            items-center
            gap-1.5
            text-[10px]
            text-white/25
          "
        >
          <Clock3
            className="h-3 w-3"
          />

          {
            relativeTime(
              record.checkedAt
            )
          }
        </div>

        <div
          className={`
            inline-flex
            min-w-[92px]
            items-center
            justify-center
            gap-1.5
            rounded-full
            border
            px-2.5
            py-1.5
            text-[10px]
            font-semibold
            ${presentation.classes}
          `}
        >
          <Icon
            className={`
              h-3.5
              w-3.5
              ${
                record.status ===
                "checking"
                  ? "animate-spin"
                  : ""
              }
            `}
          />

          {
            presentation.label
          }
        </div>
      </div>
    </div>
  );
}


export default function ExternalServiceStatusPanel({
  onCheckForUpdates,
  updateCheckStatus,
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

      window.addEventListener(
        "game-manager-service-status-changed",
        refresh
      );

      window.addEventListener(
        "storage",
        refresh
      );

      return () => {
        window.removeEventListener(
          "game-manager-service-status-changed",
          refresh
        );

        window.removeEventListener(
          "storage",
          refresh
        );
      };
    },
    []
  );

  const statuses =
    useMemo(
      () =>
        getServiceStatuses(),
      [
        revision,
        updateCheckStatus
          ?.state,
      ]
    );

  const online =
    Object.values(
      statuses
    ).filter(
      (record) =>
        record.status ===
        "online"
    ).length;

  const problems =
    Object.values(
      statuses
    ).filter(
      (record) =>
        [
          "degraded",
          "offline",
        ].includes(
          record.status
        )
    ).length;

  return (
    <section
      className="
        overflow-hidden
        rounded-2xl
        border
        border-white/[0.08]
        bg-black/10
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-white/[0.06]
          px-4
          py-4
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
              text-white/75
            "
          >
            External Services
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/30
            "
          >
            {online} online
            {problems > 0
              ? ` · ${problems} need attention`
              : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={
            onCheckForUpdates
          }
          disabled={
            !onCheckForUpdates
            ||
            updateCheckStatus
              ?.state ===
              "checking"
          }
          className="
            inline-flex
            items-center
            justify-center
            gap-2
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            px-3
            py-2
            text-xs
            font-semibold
            text-white/50
            transition
            hover:bg-white/[0.06]
            hover:text-white/75
            disabled:cursor-wait
            disabled:opacity-35
          "
          title="Refresh GitHub update status"
        >
          <RefreshCcw
            className={`
              h-3.5
              w-3.5
              ${
                updateCheckStatus
                  ?.state ===
                  "checking"
                  ? "animate-spin"
                  : ""
              }
            `}
          />

          Check Updates
        </button>
      </div>

      {[
        "pcgw",
        "renodx",
        "luma",
        "vortex",
        "github",
      ].map(
        (serviceId) => (
          <ServiceRow
            key={
              serviceId
            }
            serviceId={
              serviceId
            }
            record={
              statuses[
                serviceId
              ]
            }
          />
        )
      )}
    </section>
  );
}
