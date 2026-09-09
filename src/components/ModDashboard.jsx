import {
  CheckCircle2,
  CircleOff,
  ExternalLink,
  FileCode2,
  Loader2,
  PackageCheck,
  Puzzle,
  RefreshCcw,
  Settings2,
  Sparkles,
  Wrench,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import {
  clearLocalInstallationCache,
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  openGamePath,
} from "../services/pathActions";

import {
  error as logError,
} from "../services/logging";


function StatusBadge({
  label,
  state,
}) {
  const classes =
    {
      detected:
        "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-200/75",

      available:
        "border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-200/75",

      installed:
        "border-violet-500/20 bg-violet-500/[0.07] text-violet-200/75",

      neutral:
        "border-white/[0.08] bg-white/[0.025] text-white/35",
    }[
      state
    ]
    ?? "border-white/[0.08] bg-white/[0.025] text-white/35";

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        border
        px-2
        py-0.5
        text-[9px]
        font-semibold
        uppercase
        tracking-wide
        ${classes}
      `}
    >
      {label}
    </span>
  );
}


function ModCard({
  icon: Icon,
  title,
  description,
  badges = [],
  actionLabel = null,
  onAction = null,
  actionDisabled = false,
}) {
  const active =
    badges.some(
      (badge) =>
        badge.state
          !== "neutral"
    );

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
          className={`
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            ${
              active
                ? "bg-cyan-500/10 text-cyan-300"
                : "bg-white/[0.035] text-white/25"
            }
          `}
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
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <div
              className="
                text-sm
                font-semibold
                text-white/75
              "
            >
              {title}
            </div>

            {badges.map(
              (
                badge
              ) => (
                <StatusBadge
                  key={
                    `${badge.label}-${badge.state}`
                  }
                  label={
                    badge.label
                  }
                  state={
                    badge.state
                  }
                />
              )
            )}
          </div>

          <div
            className="
              mt-1.5
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            {description}
          </div>

          {actionLabel ? (
            <button
              type="button"
              onClick={
                onAction
              }
              disabled={
                actionDisabled
              }
              className="
                mt-3
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-white/[0.09]
                bg-white/[0.03]
                px-3
                py-2
                text-xs
                font-semibold
                text-white/55
                transition
                hover:bg-white/[0.06]
                hover:text-white/75
                disabled:cursor-not-allowed
                disabled:opacity-25
              "
            >
              <ExternalLink
                className="h-3.5 w-3.5"
              />

              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


function getCandidateUrl(
  value
) {
  if (!value) {
    return null;
  }

  if (
    typeof value
      === "string"
  ) {
    return value.startsWith(
      "http"
    )
      ? value
      : null;
  }

  const candidates = [
    value.url,
    value.link,
    value.pageUrl,
    value.downloadUrl,
    value.sourceUrl,
    value.githubUrl,
  ];

  return candidates.find(
    (candidate) =>
      typeof candidate
        === "string"
      && candidate.startsWith(
        "http"
      )
  )
    ?? null;
}


export default function ModDashboard({
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
        "[Mod Dashboard] Local inspection failed:",
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


  const local =
    installation
    ?? {};

  const modManagers =
    local.modManagers
    ?? {};

  const reshade =
    local.reshade
    ?? {};

  const specialK =
    local.specialK
    ?? {};

  const renodxAvailable =
    Boolean(
      game?.renodx
        ?.renodx
        ?.available
    );

  const lumaAvailable =
    Boolean(
      game?.renodx
        ?.luma
        ?.available
    );

  const vortexSupported =
    Boolean(
      game?.vortex
        ?.supported
    );

  const vortexInstalled =
    Boolean(
      modManagers
        .vortexExecutablePath
    );

  const vortexDetected =
    Boolean(
      modManagers
        .vortexEvidence
    );

  const fluffySupported =
    Boolean(
      game?.fluffy
        ?.supported
    );

  const fluffyInstalled =
    Boolean(
      modManagers
        .fluffyExecutablePath
    );

  const fluffyDetected =
    Boolean(
      modManagers
        .fluffyEvidence
    );

  const reshadeDetected =
    Boolean(
      reshade.installed
    );

  const specialKDetected =
    Boolean(
      specialK.detected
    );

  const genericManagerDetected =
    Boolean(
      modManagers
        .genericManagerPath
    );

  const activeItems =
    useMemo(
      () => [
        renodxAvailable,
        lumaAvailable,
        vortexSupported
          || vortexInstalled
          || vortexDetected,
        fluffySupported
          || fluffyInstalled
          || fluffyDetected,
        reshadeDetected,
        specialKDetected,
        genericManagerDetected,
      ],
      [
        renodxAvailable,
        lumaAvailable,
        vortexSupported,
        vortexInstalled,
        vortexDetected,
        fluffySupported,
        fluffyInstalled,
        fluffyDetected,
        reshadeDetected,
        specialKDetected,
        genericManagerDetected,
      ]
    );

  const enhancementCount =
    activeItems
      .filter(
        Boolean
      )
      .length;

  const localEvidenceCount =
    [
      vortexDetected,
      fluffyDetected,
      reshadeDetected,
      specialKDetected,
      genericManagerDetected,
    ]
      .filter(
        Boolean
      )
      .length;

  const renodxUrl =
    getCandidateUrl(
      game?.renodx
        ?.renodx
    );

  const lumaUrl =
    getCandidateUrl(
      game?.renodx
        ?.luma
    );


  async function openWeb(
    url
  ) {
    if (!url) {
      return;
    }

    try {
      setError(
        null
      );

      await openUrl(
        url
      );
    } catch (actionError) {
      logError(
        "[Mod Dashboard] Failed to open URL:",
        actionError
      );

      setError(
        String(
          actionError
        )
      );
    }
  }


  async function openEvidenceFolder(
    path
  ) {
    if (!path) {
      return;
    }

    try {
      setError(
        null
      );

      await openGamePath(
        path,
        game.installPath
      );
    } catch (actionError) {
      logError(
        "[Mod Dashboard] Failed to open evidence folder:",
        actionError
      );

      setError(
        String(
          actionError
        )
      );
    }
  }


  return (
    <div>
      <div
        className="
          flex
          flex-col
          gap-4
          xl:flex-row
          xl:items-start
          xl:justify-between
        "
      >
        <div>
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >
            <div
              className="
                text-lg
                font-semibold
                text-white/85
              "
            >
              {enhancementCount} enhancement{enhancementCount === 1 ? "" : "s"} detected
            </div>

            {localEvidenceCount > 0 ? (
              <StatusBadge
                label={`${localEvidenceCount} local`}
                state="detected"
              />
            ) : null}
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
            Provider compatibility and actual local installation evidence are shown separately. “Available” does not mean the enhancement is installed.
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
            ? "Scanning…"
            : "Refresh Local Evidence"}
        </button>
      </div>


      {error ? (
        <div
          className="
            mt-4
            rounded-xl
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-4
            py-3
            text-xs
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


      <div
        className="
          mt-5
          grid
          grid-cols-1
          gap-3
          md:grid-cols-2
          xl:grid-cols-3
        "
      >
        <ModCard
          icon={Sparkles}
          title="RenoDX"
          description={
            renodxAvailable
              ? "RenoDX support is available for this game."
              : "No RenoDX support is currently reported for this game."
          }
          badges={[
            {
              label:
                renodxAvailable
                  ? "Available"
                  : "Not Available",
              state:
                renodxAvailable
                  ? "available"
                  : "neutral",
            },
          ]}
          actionLabel={
            renodxUrl
              ? "View RenoDX"
              : null
          }
          onAction={
            () =>
              openWeb(
                renodxUrl
              )
          }
        />


        <ModCard
          icon={Sparkles}
          title="Luma"
          description={
            lumaAvailable
              ? "Luma Framework support is available for this game."
              : "No Luma Framework support is currently reported for this game."
          }
          badges={[
            {
              label:
                lumaAvailable
                  ? "Available"
                  : "Not Available",
              state:
                lumaAvailable
                  ? "available"
                  : "neutral",
            },
          ]}
          actionLabel={
            lumaUrl
              ? "View Luma"
              : null
          }
          onAction={
            () =>
              openWeb(
                lumaUrl
              )
          }
        />


        <ModCard
          icon={Puzzle}
          title="Vortex"
          description={
            vortexDetected
              ? "Vortex deployment evidence was detected for this installation."
              : vortexInstalled
                ? "Vortex is installed, but GameAtlas did not find per-game deployment evidence."
                : vortexSupported
                  ? "This game is supported by Vortex, but no local Vortex installation evidence was found."
                  : "No Vortex support or local evidence was detected."
          }
          badges={[
            ...(vortexSupported
              ? [
                  {
                    label:
                      "Supported",
                    state:
                      "available",
                  },
                ]
              : []),

            ...(vortexInstalled
              ? [
                  {
                    label:
                      "Installed",
                    state:
                      "installed",
                  },
                ]
              : []),

            ...(vortexDetected
              ? [
                  {
                    label:
                      "Detected for Game",
                    state:
                      "detected",
                  },
                ]
              : []),

            ...(!vortexSupported
              && !vortexInstalled
              && !vortexDetected
              ? [
                  {
                    label:
                      "Not Detected",
                    state:
                      "neutral",
                  },
                ]
              : []),
          ]}
          actionLabel={
            modManagers
              .vortexEvidencePath
              ? "Open Evidence"
              : null
          }
          onAction={
            () =>
              openEvidenceFolder(
                modManagers
                  .vortexEvidencePath
              )
          }
        />


        <ModCard
          icon={Wrench}
          title="Fluffy Mod Manager"
          description={
            fluffyDetected
              ? "Fluffy / Mod Manager evidence was detected for this installation."
              : fluffyInstalled
                ? "A Fluffy Mod Manager executable was detected locally."
                : fluffySupported
                  ? "This game is supported by Fluffy, but no local evidence was found."
                  : "No Fluffy support or local evidence was detected."
          }
          badges={[
            ...(fluffySupported
              ? [
                  {
                    label:
                      "Supported",
                    state:
                      "available",
                  },
                ]
              : []),

            ...(fluffyInstalled
              ? [
                  {
                    label:
                      "Installed",
                    state:
                      "installed",
                  },
                ]
              : []),

            ...(fluffyDetected
              ? [
                  {
                    label:
                      "Detected for Game",
                    state:
                      "detected",
                  },
                ]
              : []),

            ...(!fluffySupported
              && !fluffyInstalled
              && !fluffyDetected
              ? [
                  {
                    label:
                      "Not Detected",
                    state:
                      "neutral",
                  },
                ]
              : []),
          ]}
          actionLabel={
            modManagers
              .fluffyEvidencePath
              ? "Open Evidence"
              : null
          }
          onAction={
            () =>
              openEvidenceFolder(
                modManagers
                  .fluffyEvidencePath
              )
          }
        />


        <ModCard
          icon={FileCode2}
          title="ReShade"
          description={
            reshadeDetected
              ? `ReShade is installed for this game${reshade.proxyDll ? ` using ${reshade.proxyDll}` : ""}.`
              : "No conservative ReShade installation evidence was found."
          }
          badges={[
            {
              label:
                reshadeDetected
                  ? "Detected for Game"
                  : "Not Detected",
              state:
                reshadeDetected
                  ? "detected"
                  : "neutral",
            },
          ]}
          actionLabel={
            reshade.iniPath
              ? "Open ReShade Folder"
              : null
          }
          onAction={
            () =>
              openEvidenceFolder(
                reshade.iniPath
              )
          }
        />


        <ModCard
          icon={Settings2}
          title="Special K"
          description={
            specialKDetected
              ? "Special K evidence was found inside the game installation."
              : "No conservative Special K evidence was detected."
          }
          badges={[
            {
              label:
                specialKDetected
                  ? "Detected for Game"
                  : "Not Detected",
              state:
                specialKDetected
                  ? "detected"
                  : "neutral",
            },
          ]}
          actionLabel={
            specialK.evidencePath
              ? "Open Special K Folder"
              : null
          }
          onAction={
            () =>
              openEvidenceFolder(
                specialK.evidencePath
              )
          }
        />
      </div>


      <div
        className="
          mt-4
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
          "
        >
          <PackageCheck
            className="
              h-4
              w-4
              text-cyan-300/70
            "
          />

          <div
            className="
              text-sm
              font-semibold
              text-white/70
            "
          >
            Local Mod Evidence
          </div>
        </div>

        <div
          className="
            mt-3
            grid
            grid-cols-1
            gap-2
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {[
            {
              label:
                "Vortex deployment",
              active:
                vortexDetected,
            },
            {
              label:
                "Fluffy / Mod Manager",
              active:
                fluffyDetected,
            },
            {
              label:
                "ReShade",
              active:
                reshadeDetected,
            },
            {
              label:
                "Special K",
              active:
                specialKDetected,
            },
            {
              label:
                modManagers
                  .genericManagerName
                ?? "Other mod manager",
              active:
                genericManagerDetected,
            },
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item.label
                }
                className="
                  flex
                  items-center
                  gap-2
                  rounded-lg
                  border
                  border-white/[0.06]
                  bg-white/[0.015]
                  px-3
                  py-2.5
                  text-xs
                "
              >
                {item.active ? (
                  <CheckCircle2
                    className="
                      h-3.5
                      w-3.5
                      shrink-0
                      text-emerald-300/75
                    "
                  />
                ) : (
                  <CircleOff
                    className="
                      h-3.5
                      w-3.5
                      shrink-0
                      text-white/20
                    "
                  />
                )}

                <span
                  className={
                    item.active
                      ? "text-white/60"
                      : "text-white/25"
                  }
                >
                  {item.label}
                </span>
              </div>
            )
          )}
        </div>

        <div
          className="
            mt-3
            text-[10px]
            leading-relaxed
            text-white/20
          "
        >
          Local evidence is intentionally conservative. An undetected item may still be present if it does not leave a recognized file signature in the scanned installation.
        </div>
      </div>
    </div>
  );
}
