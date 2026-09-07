import {
  Check,
  CircleHelp,
  X,
} from "lucide-react";


function normalizeDisplayValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  if (
    typeof value === "boolean"
  ) {
    return value
      ? {
          label: "Supported",
          state: "supported",
        }
      : {
          label: "Not Supported",
          state: "unsupported",
        };
  }

  const text =
    String(value).trim();

  if (!text) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  const normalized =
    text.toLowerCase();

  if (
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "supported" ||
    normalized === "native"
  ) {
    return {
      label: "Supported",
      state: "supported",
    };
  }

  if (
    normalized === "false" ||
    normalized === "no" ||
    normalized === "none" ||
    normalized === "unsupported"
  ) {
    return {
      label: "Not Supported",
      state: "unsupported",
    };
  }

  if (
    normalized === "unknown" ||
    normalized === "n/a" ||
    normalized === "na"
  ) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  /*
   * Preserve meaningful PCGamingWiki values such as:
   *
   * limited
   * partial
   * hackable
   * always on
   * forced
   */
  return {
    label:
      text
        .split(" ")
        .map((word) => {
          if (!word) {
            return word;
          }

          return (
            word.charAt(0).toUpperCase() +
            word.slice(1)
          );
        })
        .join(" "),

    state: "custom",
  };
}


function StatusIcon({
  state,
}) {
  if (
    state === "supported"
  ) {
    return (
      <Check
        className="h-4 w-4"
      />
    );
  }

  if (
    state === "unsupported"
  ) {
    return (
      <X
        className="h-4 w-4"
      />
    );
  }

  return (
    <CircleHelp
      className="h-4 w-4"
    />
  );
}


export default function FeatureCard({
  icon: Icon,

  /*
   * Support both the existing GameDetails prop
   * and the newer label prop.
   */
  title,
  label,
  name,

  value,
  description,
}) {
  const cardTitle =
    title ??
    label ??
    name ??
    "Feature";

  const status =
    normalizeDisplayValue(
      value
    );

  console.log(
    `[FeatureCard] ${cardTitle}:`,
    {
      rawValue: value,
      normalized: status,
    }
  );

  return (
    <div
      className="
        rounded-xl
        border
        border-white/10
        bg-white/[0.03]
        p-4
        transition
        hover:border-white/20
        hover:bg-white/[0.05]
      "
    >
      <div
        className="
          mb-4
          flex
          items-start
          justify-between
          gap-4
        "
      >
        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-white/[0.06]
          "
        >
          {Icon ? (
            <Icon
              className="
                h-5
                w-5
                text-white/80
              "
            />
          ) : (
            <CircleHelp
              className="
                h-5
                w-5
                text-white/80
              "
            />
          )}
        </div>

        <div
          className={`
            inline-flex
            items-center
            gap-1.5
            rounded-full
            border
            px-2.5
            py-1
            text-xs
            font-medium

            ${
              status.state ===
              "supported"
                ? `
                  border-emerald-500/30
                  bg-emerald-500/10
                  text-emerald-300
                `
                : ""
            }

            ${
              status.state ===
              "unsupported"
                ? `
                  border-red-500/30
                  bg-red-500/10
                  text-red-300
                `
                : ""
            }

            ${
              status.state ===
              "custom"
                ? `
                  border-amber-500/30
                  bg-amber-500/10
                  text-amber-300
                `
                : ""
            }

            ${
              status.state ===
              "unknown"
                ? `
                  border-white/10
                  bg-white/[0.04]
                  text-white/50
                `
                : ""
            }
          `}
        >
          <StatusIcon
            state={
              status.state
            }
          />

          <span>
            {status.label}
          </span>
        </div>
      </div>

      <div>
        <div
          className="
            text-sm
            font-semibold
            text-white
          "
        >
          {cardTitle}
        </div>

        {description ? (
          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/45
            "
          >
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}