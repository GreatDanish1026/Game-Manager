import {
  Check,
  ExternalLink,
  Loader2,
  Minus,
  Play,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

import {
  getRhiStatus,
  launchRhi,
} from "../services/rhi";


function statusPresentation(
  status,
  supported
) {
  if (
    supported === true
    || status === "working"
    || status === "in_progress"
  ) {
    return {
      label:
        status === "in_progress"
          ? "In Progress"
          : "Supported",
      icon: Check,
      className:
        "text-emerald-300",
    };
  }

  if (
    supported === false
    || status === "incompatible"
  ) {
    return {
      label: "Not Detected",
      icon: X,
      className:
        "text-white/35",
    };
  }

  if (
    status === "planned"
  ) {
    return {
      label: "Planned",
      icon: Minus,
      className:
        "text-amber-300",
    };
  }

  if (
    status === "listed"
  ) {
    return {
      label: "Listed",
      icon: Check,
      className:
        "text-cyan-200",
    };
  }

  return {
    label: "Not Detected",
    icon: Minus,
    className:
      "text-white/35",
  };
}


function ActionButton({
  onClick,
  children,
  primary = false,
  disabled = false,
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
        gap-1.5
        rounded-lg
        border
        px-2.5
        py-1.5
        text-xs
        font-medium
        transition
        disabled:cursor-not-allowed
        disabled:opacity-35
        ${
          primary
            ? "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-200 hover:bg-cyan-500/[0.13]"
            : "border-white/10 bg-white/[0.035] text-white/65 hover:bg-white/[0.07]"
        }
      `}
    >
      {children}
    </button>
  );
}


function ModRow({
  name,
  status,
  supported,
  subtitle,
  notes,
  pageUrl,
  downloadUrl,
}) {
  const meta =
    statusPresentation(
      status,
      supported
    );

  const Icon =
    meta.icon;


  async function openLink(
    url
  ) {
    if (!url) {
      return;
    }

    try {
      await openUrl(
        url
      );
    } catch (error) {
      console.error(
        "[Mods] Failed to open URL:",
        error
      );
    }
  }


  return (
    <div
      className="
        grid
        gap-3
        border-b
        border-white/[0.06]
        px-4
        py-3.5
        last:border-b-0
        lg:grid-cols-[170px_minmax(140px,180px)_1fr_auto]
        lg:items-center
      "
    >
      <div
        className="
          text-sm
          font-semibold
          text-white
        "
      >
        {name}
      </div>

      <div
        className={`
          inline-flex
          items-center
          gap-2
          text-xs
          font-semibold
          ${meta.className}
        `}
      >
        <Icon
          className="
            h-3.5
            w-3.5
          "
        />

        {meta.label}
      </div>

      <div
        className="
          min-w-0
        "
      >
        {subtitle ? (
          <div
            className="
              truncate
              text-xs
              text-white/55
            "
            title={
              subtitle
            }
          >
            {subtitle}
          </div>
        ) : null}

        {notes ? (
          <div
            className="
              mt-1
              line-clamp-2
              text-xs
              leading-relaxed
              text-white/35
            "
            title={
              notes
            }
          >
            {notes}
          </div>
        ) : null}
      </div>

      <div
        className="
          flex
          flex-wrap
          gap-2
          lg:justify-end
        "
      >
        {pageUrl ? (
          <ActionButton
            onClick={
              () =>
                openLink(
                  pageUrl
                )
            }
          >
            <ExternalLink
              className="h-3.5 w-3.5"
            />

            View
          </ActionButton>
        ) : null}

        {downloadUrl ? (
          <ActionButton
            onClick={
              () =>
                openLink(
                  downloadUrl
                )
            }
            primary
          >
            <ExternalLink
              className="h-3.5 w-3.5"
            />

            Download
          </ActionButton>
        ) : null}
      </div>
    </div>
  );
}


export default function ModsEnhancements({
  game,
}) {
  const hdr =
    game?.renodx ?? {};

  const renodx =
    hdr?.renodx ?? {};

  const luma =
    hdr?.luma ?? {};

  const vortex =
    game?.vortex ?? {};

  const fluffy =
    game?.fluffy ?? {};

  const modAvailable =
    Boolean(
      renodx.available
      || luma.available
    );

  const [
    rhiStatus,
    setRhiStatus,
  ] =
    useState(null);

  const [
    rhiLoading,
    setRhiLoading,
  ] =
    useState(true);

  const [
    launching,
    setLaunching,
  ] =
    useState(false);


  useEffect(
    () => {
      let cancelled =
        false;

      async function load() {
        try {
          const result =
            await getRhiStatus();

          if (!cancelled) {
            setRhiStatus(
              result
            );
          }
        } catch (error) {
          console.error(
            "[RHI] Status check failed:",
            error
          );
        } finally {
          if (!cancelled) {
            setRhiLoading(
              false
            );
          }
        }
      }

      load();

      return () => {
        cancelled =
          true;
      };
    },
    []
  );


  async function handleLaunchRhi() {
    try {
      setLaunching(
        true
      );

      await launchRhi();
    } catch (error) {
      console.error(
        "[RHI] Launch failed:",
        error
      );
    } finally {
      setLaunching(
        false
      );
    }
  }


  const rhiInstalled =
    Boolean(
      rhiStatus?.installed
      ?? rhiStatus?.available
      ?? false
    );


  return (
    <div
      className="
        overflow-hidden
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
      "
    >
      <ModRow
        name="RenoDX"
        status={
          renodx.status
        }
        supported={
          renodx.available
        }
        subtitle={
          renodx.matchedName
          ?? null
        }
        notes={
          renodx.notes
        }
        pageUrl={
          renodx.pageUrl
        }
        downloadUrl={
          renodx.downloadUrl
        }
      />

      <ModRow
        name="Luma Framework"
        status={
          luma.status
        }
        supported={
          luma.available
        }
        subtitle={
          luma.matchedName
          ?? null
        }
        notes={
          luma.notes
        }
        pageUrl={
          luma.pageUrl
        }
        downloadUrl={
          luma.downloadUrl
        }
      />

      <ModRow
        name="Vortex"
        supported={
          vortex.supported
        }
        subtitle={
          vortex.extensionName
          ?? vortex.matchedGameName
          ?? null
        }
        notes={
          vortex.description
        }
        pageUrl={
          vortex.pageUrl
        }
      />

      <ModRow
        name="Fluffy Mod Manager"
        supported={
          fluffy.supported
        }
        subtitle={
          fluffy.matchedGameName
          ?? null
        }
        notes={
          fluffy.notes
        }
        pageUrl={
          fluffy.pageUrl
        }
      />

      <div
        className="
          flex
          flex-col
          gap-3
          border-t
          border-white/[0.07]
          bg-white/[0.018]
          px-4
          py-3.5
          sm:flex-row
          sm:items-center
          sm:justify-between
        "
      >
        <div>
          <div
            className="
              text-xs
              font-semibold
              text-white/65
            "
          >
            ReShade HDR Installer
          </div>

          <div
            className="
              mt-1
              text-xs
              text-white/35
            "
          >
            {rhiLoading
              ? "Checking RHI installation..."
              : !rhiInstalled
                ? "RHI is not installed."
                : modAvailable
                  ? "Ready to launch for available HDR mods."
                  : "RHI is installed, but no usable RenoDX/Luma mod was detected."
            }
          </div>
        </div>

        <ActionButton
          onClick={
            handleLaunchRhi
          }
          primary
          disabled={
            rhiLoading
            || launching
            || !rhiInstalled
            || !modAvailable
          }
        >
          {launching ? (
            <Loader2
              className="
                h-3.5
                w-3.5
                animate-spin
              "
            />
          ) : (
            <Play
              className="h-3.5 w-3.5"
            />
          )}

          Open RHI
        </ActionButton>
      </div>
    </div>
  );
}
