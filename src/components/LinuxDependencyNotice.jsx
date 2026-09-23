import {
  Check,
  Clipboard,
  PackageSearch,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import {
  useState,
} from "react";


export const LINUX_DEPENDENCIES = {
  mangohud: {
    name: "MangoHud",
    packageName: "mangohud",
    description: "Required for the performance overlay, MangoHud frame limiting, and Linux performance captures.",
  },
  gamemode: {
    name: "GameMode",
    packageName: "gamemode",
    description: "Required for the Balanced preset and the gamemoderun launch wrapper.",
  },
  gamescope: {
    name: "Gamescope",
    packageName: "gamescope",
    description: "Required for Gamescope fullscreen, scaling, HDR wrapping, and Gamescope frame limiting.",
  },
  unar: {
    name: "The Unarchiver",
    packageName: "unar",
    description: "Required to inspect and safely extract RAR and 7z archives. ZIP and extracted folders still work without it.",
  },
  protontricks: {
    name: "Protontricks",
    packageName: "protontricks",
    description: "Required to open Protontricks and Wine configuration for Steam compatibility prefixes.",
    flatpak: "flatpak install flathub com.github.Matoking.protontricks",
  },
  winetricks: {
    name: "Winetricks",
    packageName: "winetricks",
    description: "Required to open Winetricks for non-Steam Wine prefixes.",
  },
};


function commandsFor(dependency) {
  const packageName =
    dependency.packageName;
  const commands = [
    {
      label: "Fedora / Nobara",
      value: `sudo dnf install ${packageName}`,
    },
    {
      label: "Ubuntu / Debian",
      value: `sudo apt install ${packageName}`,
    },
    {
      label: "Arch / Manjaro",
      value: `sudo pacman -S ${packageName}`,
    },
  ];

  if (dependency.flatpak) {
    commands.unshift({
      label: "Flatpak",
      value: dependency.flatpak,
    });
  }

  return commands;
}


export default function LinuxDependencyNotice({
  dependency,
  onRefresh = null,
  refreshing = false,
  compact = false,
}) {
  const [copied, setCopied] =
    useState("");
  const [copyError, setCopyError] =
    useState("");

  if (!dependency) {
    return null;
  }

  async function copyCommand(
    command
  ) {
    try {
      setCopyError("");
      await navigator.clipboard.writeText(
        command
      );
      setCopied(command);
      window.setTimeout(
        () => setCopied(""),
        2000
      );
    } catch {
      setCopied("");
      setCopyError(
        "Could not access the clipboard. Select and copy the command text manually."
      );
    }
  }

  return (
    <div className={`rounded-lg border border-amber-400/15 bg-amber-400/[0.035] ${compact ? "p-2.5" : "p-3"}`}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {copied
          ? `${dependency.name} installation command copied.`
          : copyError}
      </div>

      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-amber-100/75">
            {dependency.name} is not detected
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-white/40">
            {dependency.description}
          </div>
          <div className="mt-1 text-[10px] text-white/30">
            Package: <span className="font-mono text-white/50">{dependency.packageName}</span>
          </div>
        </div>
      </div>

      <details className="group mt-2.5 rounded-md border border-white/[0.07] bg-black/10">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[10px] font-semibold text-white/45 marker:hidden hover:text-white/70">
          <PackageSearch className="h-3.5 w-3.5 text-amber-200/60" />
          Show installation commands
          <span className="ml-auto text-white/20 group-open:hidden">+</span>
          <span className="ml-auto hidden text-white/20 group-open:inline">−</span>
        </summary>

        <div className="space-y-1.5 border-t border-white/[0.06] p-2">
          {commandsFor(dependency).map((command) => (
            <button
              key={command.label}
              type="button"
              onClick={() => copyCommand(command.value)}
              className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left hover:bg-white/[0.05]"
              title={`Copy ${command.label} command`}
            >
              {copied === command.value ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              ) : (
                <Clipboard className="h-3.5 w-3.5 shrink-0 text-white/30" />
              )}
              <span className="w-24 shrink-0 text-[9px] font-semibold text-white/35">
                {command.label}
              </span>
              <code className="min-w-0 break-all text-[10px] text-cyan-100/55">
                {command.value}
              </code>
            </button>
          ))}

          <div className="px-1 pt-1 text-[9px] leading-relaxed text-white/25">
            Commands are copied only. Review your distribution&apos;s package source before running one in a terminal; package availability can vary by release. On immutable systems, install the package on the host rather than inside a temporary container.
          </div>

          {copyError ? (
            <div role="alert" className="px-1 text-[9px] text-amber-100/60">
              {copyError}
            </div>
          ) : null}
        </div>
      </details>

      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:bg-white/[0.06] hover:text-white/75 disabled:opacity-35"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Check again
        </button>
      ) : null}
    </div>
  );
}
