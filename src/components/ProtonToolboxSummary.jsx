import {
  useEffect,
  useMemo,
  useState,
} from "react";

function gameKey(game) {
  return String(
    game?.launcherId
    ?? game?.id
    ?? game?.name
    ?? "game"
  );
}

function storageKey(game) {
  return `gameatlas:proton-runtime-history:${gameKey(game)}`;
}

function readHistory(game) {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        storageKey(game)
      )
      ?? "[]"
    );

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function writeHistory(
  game,
  history
) {
  localStorage.setItem(
    storageKey(game),
    JSON.stringify(
      history.slice(0, 8)
    )
  );
}

function selectionMode(toolbox) {
  const source =
    String(
      toolbox?.runtimeInUse?.source
      ?? ""
    )
      .trim()
      .toLowerCase();

  if (
    source.includes("compattoolmapping")
    || source.includes("override")
    || source.includes("game settings")
    || source.includes("lutris")
  ) {
    return "Explicit per-game selection";
  }

  if (
    toolbox?.runtimeInUse?.name
    === "Steam automatic/default"
  ) {
    return "Launcher default";
  }

  if (
    toolbox?.runtimeInUse?.name
  ) {
    return "Detected runtime";
  }

  return "Unknown";
}

function launcherGuidance(launcher) {
  const lower =
    String(
      launcher
      ?? ""
    )
      .toLowerCase();

  if (
    lower.includes("steam")
  ) {
    return "Steam overrides use CompatToolMapping. Fully quit Steam before changing an override if Steam may rewrite config.vdf.";
  }

  if (
    lower.includes("heroic")
  ) {
    return "Heroic runtime changes update the matched game configuration. Re-open Heroic if its UI was already running.";
  }

  if (
    lower.includes("lutris")
  ) {
    return "Lutris runtime changes update the matched Wine runner version in the game configuration.";
  }

  return "Runtime behavior depends on the launcher that owns this game.";
}

function shortTime(unix) {
  if (!unix) {
    return "";
  }

  return new Date(
    Number(unix) * 1000
  ).toLocaleString();
}

export default function ProtonToolboxSummary({
  game,
  toolbox,
  onUseRuntime,
}) {
  const [
    history,
    setHistory,
  ] = useState(
    () =>
      readHistory(game)
  );

  const launcher =
    toolbox?.launcherSource
    ?? game?.store
    ?? "Unknown";

  const runtime =
    toolbox?.runtimeInUse
    ?? null;

  const mode =
    useMemo(
      () =>
        selectionMode(toolbox),
      [
        toolbox?.runtimeInUse?.name,
        toolbox?.runtimeInUse?.source,
      ]
    );

  useEffect(
    () => {
      const current =
        readHistory(game);

      if (
        !runtime?.name
      ) {
        setHistory(current);
        return;
      }

      const observation = {
        name:
          runtime.name,
        path:
          runtime.path
          ?? null,
        source:
          runtime.source
          ?? null,
        launcher,
        observedUnix:
          Math.floor(
            Date.now() / 1000
          ),
      };

      const latest =
        current[0];

      const duplicate =
        latest
        && latest.name
          === observation.name
        && latest.path
          === observation.path
        && latest.source
          === observation.source;

      const next =
        duplicate
          ? current
          : [
              observation,
              ...current,
            ].slice(0, 8);

      if (!duplicate) {
        writeHistory(
          game,
          next
        );
      }

      setHistory(next);
    },
    [
      game?.id,
      game?.launcherId,
      runtime?.name,
      runtime?.path,
      runtime?.source,
      launcher,
    ]
  );

  return (
    <div
      className="
        rounded-xl
        border
        border-cyan-400/15
        bg-cyan-400/[0.025]
        px-4
        py-3
      "
    >
      <div>
        <div className="text-xs font-semibold text-white/80">
          Proton Toolbox summary
        </div>

        <div className="mt-1 text-[11px] leading-relaxed text-white/30">
          Current runtime state, launcher behavior, and recent runtime history.
        </div>
      </div>

      <div
        className="
          mt-3
          grid
          grid-cols-1
          gap-2
          md:grid-cols-2
          xl:grid-cols-4
        "
      >
        <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/25">
            Launcher
          </div>
          <div className="mt-1 text-xs font-semibold text-white/70">
            {launcher}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/25">
            Runtime
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-white/70">
            {runtime?.name ?? "Not detected"}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/25">
            Selection mode
          </div>
          <div className="mt-1 text-xs font-semibold text-white/70">
            {mode}
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-white/25">
            Prefix
          </div>
          <div className="mt-1 text-xs font-semibold text-white/70">
            {toolbox?.prefix?.exists
              ? "Detected"
              : "Not detected"}
          </div>
        </div>
      </div>

      <div
        className="
          mt-3
          rounded-lg
          border
          border-white/[0.06]
          bg-black/10
          px-3
          py-2
          text-[10px]
          leading-relaxed
          text-white/35
        "
      >
        {launcherGuidance(launcher)}
      </div>

      {history.length > 0 ? (
        <div className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-white/25">
            Recent runtime history
          </div>

          <div className="mt-2 space-y-1.5">
            {history
              .slice(0, 4)
              .map(
                (
                  entry,
                  index
                ) => (
                  <div
                    key={
                      `${entry.name}-${entry.path ?? ""}-${entry.observedUnix}-${index}`
                    }
                    className="
                      flex
                      flex-wrap
                      items-center
                      justify-between
                      gap-2
                      rounded-lg
                      border
                      border-white/[0.06]
                      bg-white/[0.015]
                      px-3
                      py-2
                    "
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-white/60">
                        {entry.name}
                      </div>

                      <div className="mt-0.5 text-[9px] text-white/20">
                        {entry.source ?? entry.launcher}
                        {entry.observedUnix
                          ? ` • ${shortTime(entry.observedUnix)}`
                          : ""}
                      </div>
                    </div>

                    {index > 0
                    && entry.path
                    && typeof onUseRuntime
                      === "function" ? (
                      <button
                        type="button"
                        onClick={
                          () =>
                            onUseRuntime(entry)
                        }
                        className="
                          rounded-md
                          border
                          border-violet-400/15
                          bg-violet-400/[0.05]
                          px-2.5
                          py-1
                          text-[10px]
                          font-semibold
                          text-violet-100/65
                          transition
                          hover:bg-violet-400/[0.1]
                        "
                      >
                        Use Runtime
                      </button>
                    ) : null}
                  </div>
                )
              )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
