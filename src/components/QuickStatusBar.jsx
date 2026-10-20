import {
  ChevronRight,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import {
  openGameSection,
} from "../services/gameSections";


// PCGamingWiki and mod-source values arrive as booleans or status strings.
// Only positive values become chips; "no" and "unknown" stay in the full
// feature table so the header does not read like a list of failures.
function supportLabel(
  value
) {
  if (value === true || value === "working") {
    return "";
  }

  if (value === "in_progress") {
    return "WIP";
  }

  if (
    value === false
    || value === null
    || value === undefined
    || ["false", "no", "none", "not_found", "incompatible", "unknown", "n/a", ""].includes(
      String(value).trim().toLowerCase()
    )
  ) {
    return null;
  }

  return String(value);
}


function Highlight({
  label,
  detail,
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1 text-xs font-semibold text-emerald-100/85"
      title={detail ? `${label}: ${detail}` : label}
    >
      {label}
      {detail ? <span className="max-w-[140px] truncate font-medium text-emerald-100/55">{detail}</span> : null}
    </span>
  );
}


export default function QuickStatusBar({
  game,
}) {
  const features =
    game?.features ?? {};

  const candidates = [
    ["HDR", features.hdr],
    ["Ray tracing", features.rayTracing],
    ["Ultrawide", features.ultrawide],
    ["Frame generation", features.frameGeneration],
    ["RenoDX", game?.renodx?.renodx?.status],
    ["Luma", game?.renodx?.luma?.status],
    ["Vortex", game?.vortex?.supported],
    ["Fluffy Mod Manager", game?.fluffy?.supported],
  ];

  const supported =
    candidates
      .map(([label, value]) => ({ label, detail: supportLabel(value) }))
      .filter(({ detail }) => detail !== null);

  const loading =
    game?.pcgwLoading
    || (!game?.pcgwLoaded && !game?.pcgwError);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {supported.length > 0 ? (
        <>
          <Sparkles className="h-4 w-4 text-emerald-300/60" aria-hidden="true" />
          {supported.map(({ label, detail }) => (
            <Highlight key={label} label={label} detail={detail} />
          ))}
        </>
      ) : loading ? (
        <span className="inline-flex items-center gap-2 text-xs text-white/40">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Loading graphics and mod support…
        </span>
      ) : (
        <span className="text-xs text-white/40">
          No HDR, ray tracing, ultrawide, frame generation, or known mod support listed.
        </span>
      )}

      <button
        type="button"
        onClick={() => openGameSection("pc-features")}
        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-semibold text-cyan-200/70 hover:text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        All PC features
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
