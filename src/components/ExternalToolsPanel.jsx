import {
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  FileCode2,
  FolderOpen,
  Gamepad2,
  Loader2,
  Play,
  Puzzle,
  RefreshCcw,
  Settings2,
  Table2,
  Wrench,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  openPath,
} from "@tauri-apps/plugin-opener";

import {
  inspectLocalInstallation,
  clearLocalInstallationCache,
} from "../services/localInstallation";

import {
  launchGame,
} from "../services/gameLaunch";

import {
  openGamePath,
} from "../services/pathActions";

import {
  error as logError,
} from "../services/logging";


function StatusPill({
  children,
  tone = "neutral",
}) {
  const toneClass =
    {
      detected:
        "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-200/75",

      supported:
        "border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-200/75",

      available:
        "border-violet-500/20 bg-violet-500/[0.07] text-violet-200/75",

      neutral:
        "border-white/[0.08] bg-white/[0.025] text-white/35",
    }[
      tone
    ];

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
        ${toneClass}
      `}
    >
      {children}
    </span>
  );
}


function ToolCard({
  icon: Icon,
  title,
  description,
  statuses = [],
  actionLabel = null,
  onAction = null,
  actionDisabled = false,
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

            {statuses.map(
              (
                status
              ) => (
                <StatusPill
                  key={
                    `${status.label}-${status.tone}`
                  }
                  tone={
                    status.tone
                  }
                >
                  {status.label}
                </StatusPill>
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
                disabled:opacity-30
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


function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  primary = false,
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      className={`
        inline-flex
        items-center
        justify-center
        gap-2
        rounded-xl
        border
        px-3.5
        py-2.5
        text-xs
        font-semibold
        transition
        disabled:cursor-not-allowed
        disabled:opacity-30
        ${
          primary
            ? "border-cyan-400/25 bg-cyan-500/12 text-cyan-100 hover:bg-cyan-500/20"
            : "border-white/[0.09] bg-white/[0.025] text-white/55 hover:bg-white/[0.06] hover:text-white/75"
        }
      `}
    >
      <Icon
        className="h-3.5 w-3.5"
      />

      {label}
    </button>
  );
}


export default function ExternalToolsPanel({
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

  const [
    launching,
    setLaunching,
  ] =
    useState(false);


  async function loadInstallation({
    force = false,
  } = {}) {
    if (
      !game?.installPath
    ) {
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
        "[External Tools] Local detection failed:",
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
      loadInstallation();
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  async function launchDetectedPath(
    path
  ) {
    if (!path) {
      return;
    }

    try {
      setError(
        null
      );

      await openPath(
        path
      );
    } catch (actionError) {
      logError(
        "[External Tools] Failed to open tool:",
        actionError
      );

      setError(
        String(
          actionError
        )
      );
    }
  }


  async function openFolder(
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
        "[External Tools] Failed to open folder:",
        actionError
      );

      setError(
        String(
          actionError
        )
      );
    }
  }


  async function handleLaunchGame() {
    if (launching) {
      return;
    }

    setLaunching(
      true
    );

    setError(
      null
    );

    try {
      await launchGame(
        game
      );
    } catch (launchError) {
      logError(
        "[External Tools] Launch failed:",
        launchError
      );

      setError(
        String(
          launchError
        )
      );
    } finally {
      setLaunching(
        false
      );
    }
  }


  const modManagers =
    installation
      ?.modManagers
    ?? {};

  const reshade =
    installation
      ?.reshade
    ?? {};

  const specialK =
    installation
      ?.specialK
    ?? {};

  const cheatEngine =
    installation
      ?.cheatEngine
    ?? {};

  const vortexSupported =
    Boolean(
      game?.vortex
        ?.supported
    );

  const vortexEvidence =
    Boolean(
      modManagers
        .vortexEvidence
    );

  const vortexExecutable =
    modManagers
      .vortexExecutablePath
    ?? null;

  const fluffySupported =
    Boolean(
      game?.fluffy
        ?.supported
    );

  const fluffyEvidence =
    Boolean(
      modManagers
        .fluffyEvidence
    );

  const fluffyExecutable =
    modManagers
      .fluffyExecutablePath
    ?? null;

  const genericManagerName =
    modManagers
      .genericManagerName
    ?? null;

  const genericManagerPath =
    modManagers
      .genericManagerPath
    ?? null;

  const detectedCount =
    useMemo(
      () =>
        [
          vortexEvidence
            || Boolean(
              vortexExecutable
            ),
          fluffyEvidence
            || Boolean(
              fluffyExecutable
            ),
          Boolean(
            reshade.installed
          ),
          Boolean(
            specialK.detected
          ),
          Number(
            cheatEngine
              .tablesFound
            ) > 0,
          Boolean(
            genericManagerPath
          ),
        ]
          .filter(
            Boolean
          )
          .length,
      [
        vortexEvidence,
        vortexExecutable,
        fluffyEvidence,
        fluffyExecutable,
        reshade.installed,
        specialK.detected,
        cheatEngine.tablesFound,
        genericManagerPath,
      ]
    );

  const managerLaunchPath =
    vortexExecutable
    ?? fluffyExecutable
    ?? genericManagerPath
    ?? null;


  return (
    <div>
      <div
        className="
          flex
          flex-col
          gap-4
          lg:flex-row
          lg:items-start
          lg:justify-between
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
            Game Tools & Launch Hub
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
            GameAtlas keeps support, installed applications, and per-game evidence separate so a supported tool is not mistaken for one that is actually installed or active.
          </div>
        </div>

        <button
          type="button"
          onClick={
            () =>
              loadInstallation({
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
            : "Rescan Tools"}
        </button>
      </div>


      <div
        className="
          mt-4
          flex
          flex-wrap
          gap-2
        "
      >
        <ActionButton
          icon={
            launching
              ? Loader2
              : Play
          }
          label={
            launching
              ? "Launching…"
              : "Open Game"
          }
          onClick={
            handleLaunchGame
          }
          disabled={
            launching
          }
          primary
        />

        <ActionButton
          icon={Puzzle}
          label="Open Mod Manager"
          onClick={
            () =>
              launchDetectedPath(
                managerLaunchPath
              )
          }
          disabled={
            !managerLaunchPath
          }
        />

        <ActionButton
          icon={FolderOpen}
          label="Open Install Folder"
          onClick={
            () =>
              openFolder(
                game.installPath
              )
          }
          disabled={
            !game.installPath
          }
        />

        <ActionButton
          icon={Settings2}
          label="Open Config"
          onClick={
            () =>
              openFolder(
                game.technical
                  ?.configLocation
              )
          }
          disabled={
            !game.technical
              ?.configLocation
          }
        />

        <ActionButton
          icon={FolderOpen}
          label="Open Save Folder"
          onClick={
            () =>
              openFolder(
                game.technical
                  ?.saveLocation
              )
          }
          disabled={
            !game.technical
              ?.saveLocation
          }
        />
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
            leading-relaxed
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
            rounded-xl
            border
            border-white/[0.07]
            bg-white/[0.02]
            px-4
            py-4
            text-xs
            text-white/35
          "
        >
          Local tool detection requires an installation path for this game.
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
        <ToolCard
          icon={Puzzle}
          title="Vortex"
          description={
            vortexEvidence
              ? "Vortex deployment evidence was found inside this game installation."
              : vortexExecutable
                ? "Vortex is installed, but GameAtlas did not find deployment evidence for this game."
                : vortexSupported
                  ? "This game is supported by the Vortex integration, but no local Vortex installation/evidence was detected."
                  : "No Vortex support or local deployment evidence was detected."
          }
          statuses={[
            ...(vortexSupported
              ? [
                  {
                    label:
                      "Supported",
                    tone:
                      "supported",
                  },
                ]
              : []),

            ...(vortexExecutable
              ? [
                  {
                    label:
                      "Installed",
                    tone:
                      "available",
                  },
                ]
              : []),

            ...(vortexEvidence
              ? [
                  {
                    label:
                      "Detected for Game",
                    tone:
                      "detected",
                  },
                ]
              : []),

            ...(!vortexSupported
              && !vortexExecutable
              && !vortexEvidence
              ? [
                  {
                    label:
                      "Not Detected",
                    tone:
                      "neutral",
                  },
                ]
              : []),
          ]}
          actionLabel={
            vortexExecutable
              ? "Open Vortex"
              : null
          }
          onAction={
            () =>
              launchDetectedPath(
                vortexExecutable
              )
          }
        />


        <ToolCard
          icon={Wrench}
          title="Fluffy Mod Manager"
          description={
            fluffyEvidence
              ? "Fluffy / Mod Manager evidence was found in this installation."
              : fluffyExecutable
                ? "A Fluffy Mod Manager executable was found locally."
                : fluffySupported
                  ? "GameAtlas knows this game is supported by Fluffy, but no local manager evidence was detected."
                  : "No Fluffy support or local manager evidence was detected."
          }
          statuses={[
            ...(fluffySupported
              ? [
                  {
                    label:
                      "Supported",
                    tone:
                      "supported",
                  },
                ]
              : []),

            ...(fluffyExecutable
              ? [
                  {
                    label:
                      "Installed",
                    tone:
                      "available",
                  },
                ]
              : []),

            ...(fluffyEvidence
              ? [
                  {
                    label:
                      "Detected for Game",
                    tone:
                      "detected",
                  },
                ]
              : []),

            ...(!fluffySupported
              && !fluffyExecutable
              && !fluffyEvidence
              ? [
                  {
                    label:
                      "Not Detected",
                    tone:
                      "neutral",
                  },
                ]
              : []),
          ]}
          actionLabel={
            fluffyExecutable
              ? "Open Fluffy"
              : null
          }
          onAction={
            () =>
              launchDetectedPath(
                fluffyExecutable
              )
          }
        />


        <ToolCard
          icon={FileCode2}
          title="ReShade"
          description={
            reshade.installed
              ? `ReShade configuration detected${reshade.proxyDll ? ` using ${reshade.proxyDll}` : ""}.`
              : "No ReShade.ini was found in the scanned game installation."
          }
          statuses={[
            {
              label:
                reshade.installed
                  ? "Detected for Game"
                  : "Not Detected",
              tone:
                reshade.installed
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
              openFolder(
                reshade.iniPath
              )
          }
        />


        <ToolCard
          icon={Settings2}
          title="Special K"
          description={
            specialK.detected
              ? "Special K files were detected inside this game installation."
              : "No conservative Special K file signature was detected."
          }
          statuses={[
            {
              label:
                specialK.detected
                  ? "Detected for Game"
                  : "Not Detected",
              tone:
                specialK.detected
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
              openFolder(
                specialK.evidencePath
              )
          }
        />


        <ToolCard
          icon={Table2}
          title="Cheat Engine Tables"
          description={
            Number(
              cheatEngine.tablesFound
            ) > 0
              ? `${cheatEngine.tablesFound} .CT table${cheatEngine.tablesFound === 1 ? "" : "s"} found inside the game installation.`
              : "No Cheat Engine .CT tables were found inside the scanned game installation."
          }
          statuses={[
            {
              label:
                Number(
                  cheatEngine.tablesFound
                ) > 0
                  ? `${cheatEngine.tablesFound} Found`
                  : "Not Detected",
              tone:
                Number(
                  cheatEngine.tablesFound
                ) > 0
                  ? "detected"
                  : "neutral",
            },
          ]}
          actionLabel={
            cheatEngine.firstTablePath
              ? "Open Table Folder"
              : null
          }
          onAction={
            () =>
              openFolder(
                cheatEngine.firstTablePath
              )
          }
        />


        <ToolCard
          icon={CircleHelp}
          title={
            genericManagerName
              ?? "Other Mod Manager"
          }
          description={
            genericManagerPath
              ? `${genericManagerName ?? "A mod manager"} executable was found in the game installation.`
              : "No additional recognized mod-manager executable was detected in the game installation."
          }
          statuses={[
            {
              label:
                genericManagerPath
                  ? "Installed"
                  : "Not Detected",
              tone:
                genericManagerPath
                  ? "available"
                  : "neutral",
            },
          ]}
          actionLabel={
            genericManagerPath
              ? `Open ${genericManagerName ?? "Manager"}`
              : null
          }
          onAction={
            () =>
              launchDetectedPath(
                genericManagerPath
              )
          }
        />
      </div>


      <div
        className="
          mt-4
          flex
          flex-wrap
          items-center
          gap-2
          text-[10px]
          text-white/25
        "
      >
        <CheckCircle2
          className="
            h-3
            w-3
            text-emerald-300/55
          "
        />

        <span>
          {detectedCount} local tool signal{detectedCount === 1 ? "" : "s"} detected.
        </span>

        {installation?.scanTruncated ? (
          <span>
            Scan was truncated after {installation.filesScanned} filesystem entries.
          </span>
        ) : null}
      </div>
    </div>
  );
}
