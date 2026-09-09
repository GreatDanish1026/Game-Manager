import {
  Binary,
  Box,
  Cpu,
  Gamepad2,
  KeyRound,
  Loader2,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  clearLocalInstallationCache,
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  error as logError,
} from "../services/logging";


function DetailCard({
  icon: Icon,
  label,
  value,
  secondary = null,
  confidence = "Detected",
}) {
  return (
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
          items-start
          gap-3
        "
      >
        <div
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-cyan-500/10
            text-cyan-300
          "
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
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-white/30
            "
          >
            {label}
          </div>

          <div
            className="
              mt-1.5
              break-words
              text-sm
              font-semibold
              text-white/75
            "
          >
            {value || "Not detected"}
          </div>

          {secondary ? (
            <div
              className="
                mt-1
                text-xs
                leading-relaxed
                text-white/35
              "
            >
              {secondary}
            </div>
          ) : null}

          <div
            className="
              mt-2
              text-[9px]
              font-semibold
              uppercase
              tracking-wide
              text-white/20
            "
          >
            {confidence}
          </div>
        </div>
      </div>
    </div>
  );
}


function joinValues(
  values
) {
  if (
    !Array.isArray(
      values
    )
    || values.length
      === 0
  ) {
    return null;
  }

  return values.join(
    " · "
  );
}


export default function TechnicalDetailsPanel({
  game,
}) {
  const [
    installation,
    setInstallation,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState(null);


  async function load({
    force = false,
  } = {}) {
    if (!game?.installPath) {
      setInstallation(
        null
      );

      return;
    }

    setLoading(
      true
    );

    setError(
      null
    );

    try {
      if (force) {
        clearLocalInstallationCache(
          game
        );
      }

      const result =
        await inspectLocalInstallation(
          game,
          {
            force,
          }
        );

      setInstallation(
        result
      );
    } catch (loadError) {
      logError(
        "[Technical Details] Detection failed:",
        loadError
      );

      setError(
        String(
          loadError
        )
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      load();
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  const detected =
    installation
      ?.technicalDetails
    ?? {};

  const engine =
    detected.engine
    ?? game?.technical
      ?.engine
    ?? null;

  const engineVersion =
    detected.engineVersion
    ?? null;

  const graphicsApi =
    joinValues(
      detected.graphicsApis
    )
    ?? game?.technical
      ?.api
    ?? null;

  const architecture =
    detected
      .executableArchitecture
    ?? installation
      ?.executable
      ?.architecture
    ?? null;

  const antiCheat =
    joinValues(
      detected.antiCheat
    );

  const drm =
    joinValues(
      detected.drm
    );


  return (
    <div
      className="
        mb-4
        rounded-xl
        border
        border-white/[0.08]
        bg-white/[0.015]
        p-4
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div>
          <div
            className="
              text-sm
              font-semibold
              text-white/75
            "
          >
            Detected Technical Profile
          </div>

          <div
            className="
              mt-1
              max-w-3xl
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            Local detection is intentionally conservative. Unknown means GameAtlas did not find enough evidence — not that the feature is absent.
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              load({
                force:
                  true,
              })
          }
          disabled={
            loading
            || !game.installPath
          }
          className="
            inline-flex
            shrink-0
            items-center
            gap-2
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            px-3
            py-2
            text-xs
            font-semibold
            text-white/45
            hover:bg-white/[0.055]
            hover:text-white/70
            disabled:opacity-30
          "
        >
          {loading ? (
            <Loader2
              className="
                h-3.5
                w-3.5
                animate-spin
              "
            />
          ) : (
            <RefreshCcw
              className="h-3.5 w-3.5"
            />
          )}

          {loading
            ? "Detecting…"
            : "Redetect"}
        </button>
      </div>


      {error ? (
        <div
          className="
            mt-4
            rounded-lg
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-3
            py-2
            text-xs
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {!game.installPath ? (
        <div
          className="
            mt-4
            rounded-lg
            border
            border-white/[0.07]
            bg-white/[0.02]
            px-3
            py-3
            text-xs
            text-white/35
          "
        >
          Local technical detection requires an installation path.
        </div>
      ) : null}


      <div
        className="
          mt-4
          grid
          grid-cols-1
          gap-3
          md:grid-cols-2
          xl:grid-cols-3
        "
      >
        <DetailCard
          icon={Box}
          label="Engine"
          value={
            engine
          }
          secondary={
            engineVersion
              ? `Version family: ${engineVersion}`
              : null
          }
          confidence={
            detected.engine
              ? "Detected locally"
              : game?.technical
                  ?.engine
                ? "PCGamingWiki metadata"
                : "Unknown"
          }
        />

        <DetailCard
          icon={Gamepad2}
          label="Graphics API"
          value={
            graphicsApi
          }
          secondary="Multiple APIs may appear when the executable contains more than one renderer path."
          confidence={
            Array.isArray(
              detected.graphicsApis
            )
            && detected
              .graphicsApis
              .length > 0
              ? "Detected locally"
              : game?.technical
                  ?.api
                ? "PCGamingWiki metadata"
                : "Unknown"
          }
        />

        <DetailCard
          icon={Binary}
          label="Executable Architecture"
          value={
            architecture
          }
          secondary={
            installation
              ?.executable
              ?.fileName
            ?? null
          }
          confidence={
            architecture
              ? "Read from PE executable"
              : "Unknown"
          }
        />

        <DetailCard
          icon={Cpu}
          label="Process Bitness"
          value={
            architecture
              ?.includes(
                "64-bit"
              )
              ? "64-bit"
              : architecture
                  ?.includes(
                    "32-bit"
                  )
                ? "32-bit"
                : null
          }
          secondary="Derived from the selected Windows executable architecture."
          confidence={
            architecture
              ? "Detected locally"
              : "Unknown"
          }
        />

        <DetailCard
          icon={ShieldCheck}
          label="Anti-Cheat"
          value={
            antiCheat
          }
          secondary="Common local anti-cheat files are detected; kernel/service-only systems may not appear in the game folder."
          confidence={
            antiCheat
              ? "Detected locally"
              : "No local evidence"
          }
        />

        <DetailCard
          icon={KeyRound}
          label="DRM / Platform Protection"
          value={
            drm
          }
          secondary="Platform SDK files are shown as integration evidence and are not automatically treated as proof that DRM is active."
          confidence={
            drm
              ? "Evidence detected"
              : "No conservative evidence"
          }
        />
      </div>


      {Array.isArray(
        detected.detectionNotes
      )
      && detected
        .detectionNotes
        .length > 0 ? (
        <div
          className="
            mt-4
            rounded-lg
            border
            border-white/[0.06]
            bg-black/10
            px-3
            py-3
          "
        >
          <div
            className="
              text-[10px]
              font-semibold
              uppercase
              tracking-wide
              text-white/25
            "
          >
            Detection Notes
          </div>

          <ul
            className="
              mt-2
              space-y-1.5
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            {detected
              .detectionNotes
              .map(
                (
                  note
                ) => (
                  <li
                    key={
                      note
                    }
                  >
                    • {note}
                  </li>
                )
              )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
