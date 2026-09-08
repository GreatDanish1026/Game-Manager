import {
  Check,
  Minus,
  X,
} from "lucide-react";


function statusMeta(
  value
) {
  if (
    value === true
    || value === "working"
    || value === "in_progress"
  ) {
    return {
      label:
        value === "in_progress"
          ? "WIP"
          : "Yes",
      icon: Check,
      className:
        "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300",
    };
  }

  if (
    value === false
    || value === "incompatible"
  ) {
    return {
      label: "No",
      icon: X,
      className:
        "border-red-500/20 bg-red-500/[0.06] text-red-300",
    };
  }

  if (
    value === null
    || value === undefined
    || value === "not_found"
    || value === "none"
  ) {
    return {
      label: "—",
      icon: Minus,
      className:
        "border-white/10 bg-white/[0.025] text-white/35",
    };
  }

  return {
    label:
      String(value),
    icon: Check,
    className:
      "border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-200",
  };
}


function StatusPill({
  label,
  value,
}) {
  const meta =
    statusMeta(
      value
    );

  const Icon =
    meta.icon;

  return (
    <div
      className={`
        inline-flex
        max-w-full
        items-center
        gap-2
        rounded-full
        border
        px-3
        py-1.5
        text-xs
        font-medium
        ${meta.className}
      `}
      title={
        `${label}: ${meta.label}`
      }
    >
      <Icon
        className="
          h-3.5
          w-3.5
          shrink-0
        "
      />

      <span
        className="
          text-white/60
        "
      >
        {label}
      </span>

      <span
        className="
          max-w-[130px]
          truncate
          font-semibold
          text-current
        "
      >
        {meta.label}
      </span>
    </div>
  );
}


export default function QuickStatusBar({
  game,
}) {
  const features =
    game?.features ?? {};

  const hdrMods =
    game?.renodx ?? {};

  const renodx =
    hdrMods?.renodx ?? {};

  const luma =
    hdrMods?.luma ?? {};

  const vortex =
    game?.vortex ?? {};

  const fluffy =
    game?.fluffy ?? {};

  return (
    <div
      className="
        mt-5
        flex
        flex-wrap
        gap-2
      "
    >
      <StatusPill
        label="HDR"
        value={
          features.hdr
        }
      />

      <StatusPill
        label="Ray Tracing"
        value={
          features.rayTracing
        }
      />

      <StatusPill
        label="Ultrawide"
        value={
          features.ultrawide
        }
      />

      <StatusPill
        label="Frame Gen"
        value={
          features.frameGeneration
        }
      />

      <StatusPill
        label="RenoDX"
        value={
          renodx.status
        }
      />

      <StatusPill
        label="Luma"
        value={
          luma.status
        }
      />

      <StatusPill
        label="Vortex"
        value={
          vortex.supported
        }
      />

      <StatusPill
        label="Fluffy"
        value={
          fluffy.supported
        }
      />
    </div>
  );
}
