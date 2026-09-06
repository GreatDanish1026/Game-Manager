import {
  Check,
  HelpCircle,
  Wrench,
  X,
} from "lucide-react";

export default function FeatureCard({
  icon: Icon,
  title,
  supported,
}) {
  const unknown =
    supported === null ||
    supported === undefined;

  const customState =
    typeof supported ===
    "string";

  let statusText =
    "Unknown";

  let StatusIcon =
    HelpCircle;

  let statusClasses =
    "bg-gray-500/10 text-gray-500";

  if (supported === true) {
    statusText =
      "Supported";

    StatusIcon =
      Check;

    statusClasses =
      "bg-emerald-500/10 text-emerald-400";
  } else if (
    supported === false
  ) {
    statusText =
      "Not supported";

    StatusIcon =
      X;

    statusClasses =
      "bg-red-500/10 text-red-400";
  } else if (
    customState
  ) {
    statusText =
      supported;

    StatusIcon =
      Wrench;

    statusClasses =
      "bg-amber-500/10 text-amber-400";
  }

  return (
    <div
      className="
        group rounded-xl
        border border-white/[0.06]
        bg-white/[0.025]
        p-4 transition
        hover:border-white/[0.10]
        hover:bg-white/[0.04]
      "
    >
      <div
        className="
          mb-4 flex
          items-start
          justify-between
        "
      >
        <div
          className="
            flex h-9 w-9
            items-center
            justify-center
            rounded-lg
            bg-white/[0.05]
            text-gray-400
          "
        >
          <Icon
            size={18}
            strokeWidth={
              1.8
            }
          />
        </div>

        <div
          className={`
            flex h-6 w-6
            items-center
            justify-center
            rounded-full
            ${statusClasses}
          `}
        >
          <StatusIcon
            size={14}
          />
        </div>
      </div>

      <div
        className="
          text-sm
          font-medium
          text-gray-200
        "
      >
        {title}
      </div>

      <div
        className="
          mt-1
          text-xs
          capitalize
          text-gray-500
        "
      >
        {statusText}
      </div>
    </div>
  );
}