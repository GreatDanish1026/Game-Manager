import {
  Check,
  ChevronDown,
  Minus,
  X,
} from "lucide-react";

import {
  useState,
} from "react";


function valueMeta(
  value
) {
  if (value === true) {
    return {
      label: "Supported",
      icon: Check,
      className:
        "text-emerald-300",
    };
  }

  if (value === false) {
    return {
      label: "Not Supported",
      icon: X,
      className:
        "text-red-300",
    };
  }

  if (
    value === null
    || value === undefined
    || value === ""
  ) {
    return {
      label: "Unknown",
      icon: Minus,
      className:
        "text-white/35",
    };
  }

  return {
    label:
      String(value),
    icon: Check,
    className:
      "text-cyan-200",
  };
}


function FeatureTile({
  title,
  value,
  description,
}) {
  const [
    open,
    setOpen,
  ] =
    useState(false);

  const meta =
    valueMeta(
      value
    );

  const Icon =
    meta.icon;

  const hasDetails =
    Boolean(
      description
    );


  return (
    <div
      className="
        overflow-hidden
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
      "
    >
      <button
        type="button"
        onClick={
          () => {
            if (hasDetails) {
              setOpen(
                (current) =>
                  !current
              );
            }
          }
        }
        className={`
          flex
          w-full
          items-center
          gap-3
          p-3.5
          text-left
          ${
            hasDetails
              ? "cursor-pointer hover:bg-white/[0.025]"
              : "cursor-default"
          }
        `}
      >
        <div
          className={`
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-white/[0.035]
            ${meta.className}
          `}
        >
          <Icon
            className="h-4 w-4"
          />
        </div>

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              truncate
              text-xs
              font-medium
              text-white/50
            "
          >
            {title}
          </div>

          <div
            className={`
              mt-1
              truncate
              text-sm
              font-semibold
              ${meta.className}
            `}
          >
            {meta.label}
          </div>
        </div>

        {hasDetails ? (
          <ChevronDown
            className={`
              h-4
              w-4
              shrink-0
              text-white/25
              transition-transform
              ${
                open
                  ? "rotate-180"
                  : ""
              }
            `}
          />
        ) : null}
      </button>

      {open ? (
        <div
          className="
            border-t
            border-white/[0.06]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-white/45
          "
        >
          {description}
        </div>
      ) : null}
    </div>
  );
}


export default function CompactFeatureGrid({
  features,
}) {
  const items = [
    {
      title: "Widescreen",
      value: features.widescreen,
      description: features.widescreenNotes,
    },
    {
      title: "Multi-Monitor",
      value: features.multimonitor,
      description: features.multimonitorNotes,
    },
    {
      title: "Ultrawide",
      value: features.ultrawide,
      description: features.ultrawideNotes,
    },
    {
      title: "4K Ultra HD",
      value: features.fourK,
      description: features.fourKNotes,
    },
    {
      title: "Field of View",
      value: features.fov,
      description: features.fovNotes,
    },
    {
      title: "Windowed",
      value: features.windowed,
      description: features.windowedNotes,
    },
    {
      title: "Borderless",
      value: features.borderless,
      description: features.borderlessNotes,
    },
    {
      title: "Anisotropic Filtering",
      value: features.anisotropic,
      description: features.anisotropicNotes,
    },
    {
      title: "Anti-Aliasing",
      value: features.antialiasing,
      description: features.antialiasingNotes,
    },
    {
      title: "Upscaling",
      value: features.upscaling,
      description:
        [
          features.upscalingTech
            ? `Technology: ${features.upscalingTech}`
            : null,
          features.upscalingNotes,
        ]
          .filter(Boolean)
          .join(" — ")
          || null,
    },
    {
      title: "Frame Generation",
      value: features.frameGeneration,
      description:
        [
          features.frameGenerationTech
            ? `Technology: ${features.frameGenerationTech}`
            : null,
          features.frameGenerationNotes,
        ]
          .filter(Boolean)
          .join(" — ")
          || null,
    },
    {
      title: "VSync",
      value: features.vsync,
      description: features.vsyncNotes,
    },
    {
      title: "60 FPS",
      value: features.sixtyFps,
      description: features.sixtyFpsNotes,
    },
    {
      title: "120+ FPS",
      value: features.oneTwentyFps,
      description: features.oneTwentyFpsNotes,
    },
    {
      title: "HDR",
      value: features.hdr,
      description: features.hdrNotes,
    },
    {
      title: "Ray Tracing",
      value: features.rayTracing,
      description: features.rayTracingNotes,
    },
    {
      title: "Color Blind Mode",
      value: features.colorBlind,
      description: features.colorBlindNotes,
    },
  ];


  return (
    <div
      className="
        grid
        grid-cols-1
        gap-2.5
        sm:grid-cols-2
        xl:grid-cols-3
        2xl:grid-cols-4
      "
    >
      {items.map(
        (item) => (
          <FeatureTile
            key={
              item.title
            }
            {...item}
          />
        )
      )}
    </div>
  );
}
