import {
  CheckCircle2,
  Cpu,
  Gauge,
  HardDrive,
  Layers3,
  Loader2,
  MonitorCog,
  RefreshCw,
  Store,
  TriangleAlert,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getLinuxPerformanceCapabilities,
} from "../services/linuxPerformance";

import {
  getWindowsPerformanceDiagnostics,
} from "../services/windowsPerformanceDiagnostics";
import LinuxActionStatus from "./LinuxActionStatus";


function displayLauncher(game) {
  const store =
    String(
      game?.store
      ?? game?.source
      ?? ""
    )
      .trim()
      .toLowerCase();

  if (store.includes("steam")) {
    return "Steam";
  }

  if (
    store.includes("heroic")
    || store === "epic"
    || store === "gog"
  ) {
    return "Heroic";
  }

  if (store.includes("lutris")) {
    return "Lutris";
  }

  return game?.store
    || game?.source
    || "Not identified";
}


function runtimeDetails(game) {
  const runtime =
    String(game?.runtime ?? "")
      .trim()
      .toLowerCase();

  const native =
    Boolean(game?.nativeLinux)
    || runtime === "native_linux"
    || runtime === "native linux";

  if (native) {
    return {
      label: "Native Linux",
      detail: "No Windows compatibility layer required",
      usesPrefix: false,
    };
  }

  const configuredRuntime =
    game?.compatibilityTool
    || game?.heroicRunner
    || game?.lutrisRunner
    || null;

  const usesPrefix =
    Boolean(game?.proton)
    || Boolean(game?.protonPrefix)
    || runtime.includes("proton")
    || runtime.includes("wine")
    || runtime === "windows";

  return {
    label:
      configuredRuntime
      || (usesPrefix
        ? "Proton / Wine"
        : game?.runtime || "Not identified"),
    detail: usesPrefix
      ? "Windows game through a compatibility layer"
      : "Runtime reported by the launcher",
    usesPrefix,
  };
}


function statusForCheck(check) {
  if (!check) {
    return "info";
  }

  return check.state === "pass"
    ? "good"
    : check.state === "warn"
      ? "attention"
      : "info";
}


function ReadinessCard({
  icon: Icon,
  label,
  value,
  detail,
  status = "info",
}) {
  const styles = {
    attention: {
      icon: "bg-amber-400/10 text-amber-300",
      value: "text-amber-100",
    },
    good: {
      icon: "bg-emerald-400/10 text-emerald-300",
      value: "text-emerald-100",
    },
    info: {
      icon: "bg-cyan-400/10 text-cyan-300",
      value: "text-white/80",
    },
  }[status];

  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-black/15 p-3.5"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
            {label}
          </div>

          <div className={`mt-0.5 break-words text-sm font-semibold ${styles.value}`}>
            {value}
          </div>

          {detail ? (
            <div className="mt-1 break-all text-[11px] leading-relaxed text-white/35">
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


export default function LinuxReadinessOverview({
  game,
}) {
  const [state, setState] = useState({
    capabilities: null,
    diagnostics: null,
    error: null,
    loading: true,
  });

  const refresh =
    useCallback(async () => {
      setState((current) => ({
        ...current,
        error: null,
        loading: true,
      }));

      const [capabilities, diagnostics] =
        await Promise.allSettled([
          getLinuxPerformanceCapabilities(),
          getWindowsPerformanceDiagnostics(game),
        ]);

      const capabilityData =
        capabilities.status === "fulfilled"
          ? capabilities.value
          : null;

      const diagnosticData =
        diagnostics.status === "fulfilled"
          ? diagnostics.value
          : null;

      setState({
        capabilities: capabilityData,
        diagnostics: diagnosticData,
        error:
          capabilities.status === "rejected"
          || diagnostics.status === "rejected"
            ? capabilityData || diagnosticData
              ? "Some Linux host checks could not be completed."
              : "The Linux host checks could not be completed."
            : null,
        loading: false,
      });
    }, [game]);

  useEffect(() => {
    let active = true;

    async function load() {
      const [capabilities, diagnostics] =
        await Promise.allSettled([
          getLinuxPerformanceCapabilities(),
          getWindowsPerformanceDiagnostics(game),
        ]);

      if (!active) {
        return;
      }

      const capabilityData =
        capabilities.status === "fulfilled"
          ? capabilities.value
          : null;

      const diagnosticData =
        diagnostics.status === "fulfilled"
          ? diagnostics.value
          : null;

      setState({
        capabilities: capabilityData,
        diagnostics: diagnosticData,
        error:
          capabilities.status === "rejected"
          || diagnostics.status === "rejected"
            ? capabilityData || diagnosticData
              ? "Some Linux host checks could not be completed."
              : "The Linux host checks could not be completed."
            : null,
        loading: false,
      });
    }

    setState({
      capabilities: null,
      diagnostics: null,
      error: null,
      loading: true,
    });

    load();

    return () => {
      active = false;
    };
  }, [game]);

  const summary = useMemo(() => {
    const runtime = runtimeDetails(game);
    const checks = state.diagnostics?.checks ?? [];
    const check = (key) =>
      checks.find((item) => item.key === key);
    const graphics = check("gpu-driver");
    const storage = check("storage");
    const warnings = checks.filter((item) => item.state === "warn");
    const tools = [
      ["MangoHud", state.capabilities?.mangoHud],
      ["GameMode", state.capabilities?.gameMode],
      ["Gamescope", state.capabilities?.gamescope],
    ];
    const availableTools =
      tools.filter(([, tool]) => tool?.available);
    const missingTools = state.capabilities
      ? tools
          .filter(([, tool]) => !tool?.available)
          .map(([name]) => name)
      : [];
    const missingPrefix =
      runtime.usesPrefix
      && !game?.protonPrefix;

    let action = {
      label: "Open performance controls",
      sectionId: "compatibility-performance",
      targetId: "linux-performance-controls",
    };

    if (!game?.installPath) {
      action = {
        label: "Review installation",
        sectionId: "files-installation",
      };
    } else if (missingPrefix) {
      action = {
        label: "Inspect Proton setup",
        sectionId: "technical-troubleshooting",
        targetId: "linux-proton-toolbox",
      };
    } else if (graphics && graphics.state !== "pass") {
      action = {
        label: "Review Linux diagnostics",
        sectionId: "technical-troubleshooting",
        targetId: "diagnostic-windows-performance",
      };
    } else if (storage?.state === "warn" || warnings.length > 0) {
      action = {
        label: "Review Linux findings",
        sectionId: "technical-troubleshooting",
        targetId: "diagnostic-windows-performance",
      };
    }

    return {
      action,
      availableTools,
      graphics,
      missingPrefix,
      missingTools,
      runtime,
      storage,
      warnings,
    };
  }, [game, state.capabilities, state.diagnostics]);

  function jumpTo({
    sectionId,
    targetId,
  }) {
    window.dispatchEvent(
      new CustomEvent(
        "game-manager-open-section",
        {
          detail: {
            id: sectionId,
          },
        }
      )
    );

    window.setTimeout(() => {
      const target =
        document.getElementById(targetId)
        ?? document.getElementById(`game-section-${sectionId}`);

      target?.scrollIntoView({
        behavior:
          window.matchMedia?.(
            "(prefers-reduced-motion: reduce)"
          ).matches
            ? "auto"
            : "smooth",
        block: "start",
      });
    }, 100);
  }

  const hasAttention =
    !state.loading
    && (
      Boolean(state.error)
      ||
      summary.missingPrefix
      || summary.warnings.length > 0
      || !game?.installPath
    );

  return (
    <section
      aria-labelledby="linux-readiness-title"
      aria-busy={state.loading}
      className="mb-5 mt-4 rounded-2xl border border-cyan-400/15 bg-gradient-to-br from-cyan-500/[0.07] via-white/[0.025] to-transparent p-4 md:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
            <MonitorCog className="h-5 w-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="linux-readiness-title"
                className="text-base font-semibold text-white/90"
              >
                Linux readiness
              </h2>

              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  state.loading
                    ? "border-white/10 bg-white/[0.04] text-white/40"
                    : hasAttention
                      ? "border-amber-400/20 bg-amber-400/[0.08] text-amber-200"
                      : "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200"
                }`}
              >
                {state.loading
                  ? "Checking"
                  : state.error
                    ? "Partial"
                    : hasAttention
                      ? "Review"
                    : "Ready"}
              </span>
            </div>

            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/40">
              A read-only snapshot of the detected launcher, runtime, install, graphics, and optional Linux tools. Game-specific dependencies may still need a deeper diagnostic.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={state.loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white/85 disabled:cursor-wait disabled:opacity-50"
          >
            {state.loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </button>

          <button
            type="button"
            onClick={() => jumpTo(summary.action)}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-500/15"
          >
            <Gauge className="h-3.5 w-3.5" />
            {summary.action.label}
          </button>
        </div>
      </div>

      <div
        aria-live="polite"
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        <ReadinessCard
          icon={Cpu}
          label="Runtime"
          value={summary.runtime.label}
          detail={summary.runtime.detail}
          status={summary.runtime.label === "Not identified" ? "attention" : "good"}
        />

        <ReadinessCard
          icon={Store}
          label="Launcher"
          value={displayLauncher(game)}
          detail={game?.launcherId ? `Game ID ${game.launcherId}` : "Launcher metadata"}
          status={displayLauncher(game) === "Not identified" ? "attention" : "info"}
        />

        <ReadinessCard
          icon={Layers3}
          label="Compatibility prefix"
          value={
            !summary.runtime.usesPrefix
              ? "Not required"
              : game?.protonPrefix
                ? "Detected"
                : "Not reported"
          }
          detail={
            game?.protonPrefix
            || (summary.missingPrefix
              ? "It may be created after the first launch"
              : "Native Linux runtime")
          }
          status={summary.missingPrefix ? "attention" : "good"}
        />

        <ReadinessCard
          icon={MonitorCog}
          label="Graphics baseline"
          value={
            state.loading
              ? "Checking…"
              : summary.graphics?.label || "Not available"
          }
          detail={summary.graphics?.detail || "Run diagnostics for driver details"}
          status={statusForCheck(summary.graphics)}
        />

        <ReadinessCard
          icon={HardDrive}
          label="Game storage"
          value={
            !game?.installPath
              ? "Install path missing"
              : state.loading
                ? "Checking…"
                : summary.storage?.label || "Path detected"
          }
          detail={summary.storage?.detail || game?.installPath || "No local installation path reported"}
          status={!game?.installPath ? "attention" : statusForCheck(summary.storage)}
        />

        <ReadinessCard
          icon={summary.missingTools.length > 0 ? TriangleAlert : CheckCircle2}
          label="Optional tools"
          value={
            state.loading
              ? "Checking…"
              : state.capabilities
                ? `${summary.availableTools.length} of 3 detected`
                : "Not available"
          }
          detail={
            !state.capabilities
              ? "Tool detection did not complete"
              : summary.missingTools.length > 0
              ? `Optional: ${summary.missingTools.join(", ")}`
              : "MangoHud, GameMode, and Gamescope are available"
          }
          status="info"
        />
      </div>

      <LinuxActionStatus
        type="warning"
        message={state.error}
        details="You can refresh or open the detailed Linux diagnostics."
        className="mt-3"
      />
    </section>
  );
}
