import {
  Cpu,
  FolderOpen,
  Layers3,
  MonitorCog,
} from "lucide-react";

import {
  openGamePath,
} from "../services/pathActions";

function Detail({ icon: Icon, label, value, mono = false, action = null }) {
  if (value === null || value === undefined || value === "") return null;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/35">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>

      <div className={`break-words text-sm text-white/80 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </div>

      {action ? (
        <button
          type="button"
          onClick={action}
          className="mt-2 text-xs font-medium text-cyan-300 hover:text-cyan-200"
        >
          Open
        </button>
      ) : null}
    </div>
  );
}

function runtimeLabel(runtime) {
  switch (String(runtime ?? "").toLowerCase()) {
    case "proton":
      return "Windows game via Proton";
    case "native_linux":
      return "Native Linux";
    case "windows_unknown":
      return "Windows game";
    default:
      return "Unknown";
  }
}

export default function LinuxRuntimePanel({ game }) {
  if (
    !game ||
    (
      game.source !== "steam-linux" &&
      !game.proton &&
      !game.nativeLinux &&
      !game.protonPrefix
    )
  ) {
    return null;
  }

  const tool =
    game.compatibilityTool ??
    (game.proton ? "Steam default / automatic" : null);

  const openPrefix =
    game.protonPrefix
      ? () => openGamePath(game.protonPrefix, game.installPath)
      : null;

  return (
    <div className="mt-4 rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.045] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
          <MonitorCog className="h-4 w-4" />
        </div>

        <div>
          <div className="text-sm font-semibold text-white/85">
            Linux Compatibility
          </div>
          <div className="text-xs text-white/40">
            Steam runtime detected by GameAtlas
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <Detail icon={MonitorCog} label="Runtime" value={runtimeLabel(game.runtime)} />
        <Detail icon={Layers3} label="Compatibility Tool" value={tool} />
        <Detail icon={Cpu} label="Steam App ID" value={game.launcherId} mono />
        <Detail
          icon={FolderOpen}
          label="Proton Prefix"
          value={game.protonPrefix}
          mono
          action={openPrefix}
        />
      </div>
    </div>
  );
}
