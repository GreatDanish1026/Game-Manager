import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
} from "lucide-react";


const TYPES = {
  error: {
    icon: AlertCircle,
    classes: "border-red-500/20 bg-red-500/[0.055] text-red-100/75",
  },
  info: {
    icon: Info,
    classes: "border-cyan-400/15 bg-cyan-400/[0.04] text-cyan-100/65",
  },
  loading: {
    icon: Loader2,
    classes: "border-white/[0.08] bg-white/[0.025] text-white/45",
  },
  success: {
    icon: CheckCircle2,
    classes: "border-emerald-500/15 bg-emerald-500/[0.045] text-emerald-100/70",
  },
  warning: {
    icon: TriangleAlert,
    classes: "border-amber-400/15 bg-amber-400/[0.04] text-amber-100/70",
  },
};


export default function LinuxActionStatus({
  type = "info",
  message,
  details = null,
  className = "",
}) {
  if (!message) {
    return null;
  }

  const style =
    TYPES[type]
    ?? TYPES.info;
  const Icon = style.icon;
  const isError =
    type === "error";
  const isLoading =
    type === "loading";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-relaxed ${style.classes} ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={`mt-0.5 h-4 w-4 shrink-0 ${isLoading ? "animate-spin motion-reduce:animate-none" : ""}`}
      />

      <div className="min-w-0">
        <div className="break-words">
          {message}
        </div>

        {details ? (
          <div className="mt-1 break-all text-[10px] opacity-60">
            {details}
          </div>
        ) : null}
      </div>
    </div>
  );
}
