import {
  CheckCircle2,
  Cpu,
  Loader2,
  MemoryStick,
  MonitorCog,
  ShieldQuestion,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getSystemHardware,
} from "../services/systemHardware";


function formatBytes(
  bytes
) {
  if (!bytes) {
    return "Unknown";
  }

  return `${(
    bytes
    / 1024
    / 1024
    / 1024
  ).toFixed(
    1
  )} GB`;
}


function CapabilityRow({
  label,
  gameSupport,
  hardwareSupport,
  detail,
}) {
  const state =
    gameSupport === false
      ? "game-no"
      : hardwareSupport === true
        ? "yes"
        : hardwareSupport === false
          ? "no"
          : "unknown";

  return (
    <div
      className="
        flex
        items-start
        gap-3
        border-b
        border-white/[0.055]
        px-4
        py-3
        last:border-b-0
      "
    >
      {state === "yes" ? (
        <CheckCircle2
          className="
            mt-0.5
            h-4
            w-4
            shrink-0
            text-emerald-300/80
          "
        />
      ) : state === "no" ? (
        <XCircle
          className="
            mt-0.5
            h-4
            w-4
            shrink-0
            text-red-300/65
          "
        />
      ) : (
        <ShieldQuestion
          className="
            mt-0.5
            h-4
            w-4
            shrink-0
            text-white/22
          "
        />
      )}

      <div
        className="
          min-w-0
        "
      >
        <div
          className="
            text-sm
            font-medium
            text-white/68
          "
        >
          {label}
        </div>

        <div
          className="
            mt-0.5
            text-xs
            leading-relaxed
            text-white/30
          "
        >
          {detail}
        </div>
      </div>
    </div>
  );
}


export default function HardwareCapabilityPanel({
  game,
}) {
  const [
    hardware,
    setHardware,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState(null);


  useEffect(
    () => {
      let active =
        true;

      setLoading(
        true
      );

      getSystemHardware()
        .then(
          (value) => {
            if (active) {
              setHardware(
                value
              );

              setError(
                null
              );
            }
          }
        )
        .catch(
          (error) => {
            if (active) {
              setError(
                String(
                  error
                )
              );
            }
          }
        )
        .finally(
          () => {
            if (active) {
              setLoading(
                false
              );
            }
          }
        );

      return () => {
        active =
          false;
      };
    },
    []
  );


  const capability =
    useMemo(
      () => {
        const gpus =
          hardware?.gpus
          ?? [];

        const hasRtx =
          gpus.some(
            (gpu) =>
              gpu.nvidiaRtx
          );

        const hasNvidiaFg =
          gpus.some(
            (gpu) =>
              gpu.nvidiaFrameGenerationCapable
          );

        const hasAmdRt =
          gpus.some(
            (gpu) =>
              gpu.amdRayTracingClass
          );

        const hasArc =
          gpus.some(
            (gpu) =>
              gpu.intelArc
          );

        const hasRtClass =
          hasRtx
          || hasAmdRt
          || hasArc;

        return {
          hasRtx,
          hasNvidiaFg,
          hasAmdRt,
          hasArc,
          hasRtClass,
        };
      },
      [
        hardware,
      ]
    );


  if (loading) {
    return (
      <div
        className="
          flex
          items-center
          gap-3
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          px-4
          py-5
          text-sm
          text-white/35
        "
      >
        <Loader2
          className="
            h-4
            w-4
            animate-spin
          "
        />

        Reading local hardware…
      </div>
    );
  }


  if (error) {
    return (
      <div
        className="
          rounded-xl
          border
          border-red-500/20
          bg-red-500/[0.05]
          px-4
          py-3
          text-xs
          text-red-300/75
        "
      >
        {error}
      </div>
    );
  }


  const features =
    game.features
    ?? {};

  return (
    <div
      className="
        space-y-4
      "
    >
      <div
        className="
          grid
          grid-cols-1
          gap-3
          md:grid-cols-2
          xl:grid-cols-3
        "
      >
        <div
          className="
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            p-4
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            <Cpu
              className="h-4 w-4"
            />

            CPU
          </div>

          <div
            className="
              mt-2
              text-sm
              font-medium
              text-white/65
            "
          >
            {hardware?.cpuName
              ?? "Unknown"
            }
          </div>
        </div>


        <div
          className="
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            p-4
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            <MemoryStick
              className="h-4 w-4"
            />

            Memory
          </div>

          <div
            className="
              mt-2
              text-sm
              font-medium
              text-white/65
            "
          >
            {formatBytes(
              hardware?.ramBytes
            )}
          </div>
        </div>


        <div
          className="
            rounded-xl
            border
            border-white/[0.08]
            bg-black/10
            p-4
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-xs
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            <MonitorCog
              className="h-4 w-4"
            />Operating System</div>

          <div
            className="
              mt-2
              text-sm
              font-medium
              text-white/65
            "
          >
            {hardware?.osName
              ?? "Windows"
            }
          </div>

          {hardware?.osVersion ? (
            <div
              className="
                mt-1
                text-xs
                text-white/28
              "
            >
              {hardware.osVersion}
            </div>
          ) : null}
        </div>
      </div>


      <div
        className="
          overflow-hidden
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
        "
      >
        <div
          className="
            border-b
            border-white/[0.06]
            px-4
            py-3.5
          "
        >
          <div
            className="
              text-sm
              font-semibold
              text-white/70
            "
          >
            Detected GPUs
          </div>
        </div>

        {(hardware?.gpus
          ?? [])
          .map(
            (
              gpu,
              index
            ) => (
              <div
                key={
                  `${gpu.name}-${index}`
                }
                className="
                  border-b
                  border-white/[0.055]
                  px-4
                  py-3
                  last:border-b-0
                "
              >
                <div
                  className="
                    text-sm
                    font-medium
                    text-white/68
                  "
                >
                  {gpu.name}
                </div>

                <div
                  className="
                    mt-1
                    text-xs
                    text-white/28
                  "
                >
                  {gpu.vendor}
                  {gpu.dedicatedMemoryBytes
                    ? ` • ${formatBytes(gpu.dedicatedMemoryBytes)} reported VRAM`
                    : ""
                  }
                </div>
              </div>
            )
          )}
      </div>


      <div
        className="
          overflow-hidden
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
        "
      >
        <div
          className="
            border-b
            border-white/[0.06]
            px-4
            py-3.5
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
              text-sm
              font-semibold
              text-white/70
            "
          >
            <Sparkles
              className="
                h-4
                w-4
                text-cyan-300/75
              "
            />

            Hardware-Aware Capability Checks
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/28
            "
          >
            Conservative checks based on detected GPU families. GameAtlas does not estimate FPS.
          </div>
        </div>


        <CapabilityRow
          label="Ray Tracing"
          gameSupport={
            features.rayTracing
          }
          hardwareSupport={
            capability.hasRtClass
          }
          detail={
            features.rayTracing === false
              ? "PCGamingWiki reports that this game does not support ray tracing."
              : capability.hasRtClass
                ? "A hardware ray-tracing-class GPU family was detected."
                : "No RTX, Radeon RX 6000+-class, or Intel Arc GPU was recognized."
          }
        />

        <CapabilityRow
          label="NVIDIA DLSS"
          gameSupport={
            features.upscaling
          }
          hardwareSupport={
            capability.hasRtx
          }
          detail={
            capability.hasRtx
              ? "An NVIDIA RTX GPU was detected, satisfying the basic hardware family requirement for DLSS."
              : "DLSS requires an NVIDIA RTX-class GPU; none was recognized."
          }
        />

        <CapabilityRow
          label="NVIDIA DLSS Frame Generation"
          gameSupport={
            features.frameGeneration
          }
          hardwareSupport={
            capability.hasNvidiaFg
          }
          detail={
            capability.hasNvidiaFg
              ? "An NVIDIA RTX 40-series or newer GPU family was detected."
              : "No NVIDIA RTX 40-series or newer GPU was recognized."
          }
        />

        <CapabilityRow
          label="Intel XeSS"
          gameSupport={
            features.upscaling
          }
          hardwareSupport={
            capability.hasArc
              ? true
              : null
          }
          detail={
            capability.hasArc
              ? "An Intel Arc GPU was detected."
              : "No Intel Arc GPU was detected. XeSS may still run on other supported shader-model hardware, so compatibility is left unconfirmed."
          }
        />
      </div>


      <div
        className="
          text-[11px]
          leading-relaxed
          text-white/24
        "
      >
        Hardware capability checks are intentionally conservative and based on recognizable GPU families.
        They are not performance predictions and do not validate display-level HDR support.
      </div>
    </div>
  );
}
