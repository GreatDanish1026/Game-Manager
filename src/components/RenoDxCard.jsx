import {
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Play,
  Sparkles,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getRhiStatus,
  launchRhi,
} from "../services/rhi";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

const RENODX_MODS_URL =
  "https://github.com/clshortfuse/renodx/wiki/Mods";


function getStatusDisplay(
  renodx
) {
  if (!renodx) {
    return {
      label: "Unknown",
      state: "unknown",
    };
  }

  if (renodx.available) {
    return {
      label: "Available",
      state: "available",
    };
  }

  const status =
    renodx.status
      ?.trim()
      .toLowerCase();

  if (
    status === "in_progress" ||
    status === "in progress"
  ) {
    return {
      label: "In Progress",
      state: "progress",
    };
  }

  if (
    status === "listed"
  ) {
    return {
      label: "Listed",
      state: "listed",
    };
  }

  if (
    status === "not_found" ||
    status === "not found"
  ) {
    return {
      label: "Not Available",
      state: "unavailable",
    };
  }

  if (renodx.status) {
    return {
      label:
        renodx.status
          .replaceAll("_", " ")
          .split(" ")
          .map((word) => {
            if (!word) {
              return word;
            }

            return (
              word.charAt(0).toUpperCase() +
              word.slice(1).toLowerCase()
            );
          })
          .join(" "),

      state: "unknown",
    };
  }

  return {
    label:
      renodx.available
        ? "Available"
        : "Not Available",

    state:
      renodx.available
        ? "available"
        : "unavailable",
  };
}


function StatusBadge({
  renodx,
}) {
  const status =
    getStatusDisplay(
      renodx
    );

  if (
    status.state === "available"
  ) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-emerald-500/30
          bg-emerald-500/10
          px-2.5
          py-1
          text-xs
          font-semibold
          text-emerald-300
        "
      >
        <Check
          className="h-3.5 w-3.5"
        />

        {status.label}
      </div>
    );
  }

  if (
    status.state === "progress" ||
    status.state === "listed"
  ) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-amber-500/30
          bg-amber-500/10
          px-2.5
          py-1
          text-xs
          font-semibold
          text-amber-300
        "
      >
        <AlertCircle
          className="h-3.5 w-3.5"
        />

        {status.label}
      </div>
    );
  }

  if (
    status.state === "unavailable"
  ) {
    return (
      <div
        className="
          inline-flex
          items-center
          gap-1.5
          rounded-full
          border
          border-red-500/30
          bg-red-500/10
          px-2.5
          py-1
          text-xs
          font-semibold
          text-red-300
        "
      >
        <X
          className="h-3.5 w-3.5"
        />

        {status.label}
      </div>
    );
  }

  return (
    <div
      className="
        inline-flex
        items-center
        gap-1.5
        rounded-full
        border
        border-white/10
        bg-white/[0.04]
        px-2.5
        py-1
        text-xs
        font-semibold
        text-white/45
      "
    >
      <AlertCircle
        className="h-3.5 w-3.5"
      />

      {status.label}
    </div>
  );
}


function DetailRow({
  label,
  value,
}) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  return (
    <div
      className="
        flex
        items-start
        justify-between
        gap-4
        border-t
        border-white/[0.06]
        py-3
        first:border-t-0
      "
    >
      <span
        className="
          shrink-0
          text-sm
          text-white/40
        "
      >
        {label}
      </span>

      <span
        className="
          max-w-[65%]
          text-right
          text-sm
          leading-relaxed
          text-white/75
        "
      >
        {value}
      </span>
    </div>
  );
}


export default function RenoDxCard({
  game,
}) {
  const renodx =
    game?.renodx;

  const available =
    renodx?.available ??
    false;

  const [
    rhiChecking,
    setRhiChecking,
  ] = useState(true);

  const [
    rhiInstalled,
    setRhiInstalled,
  ] = useState(false);

  const [
    rhiPath,
    setRhiPath,
  ] = useState(null);

  const [
    rhiLaunching,
    setRhiLaunching,
  ] = useState(false);

  const [
    rhiError,
    setRhiError,
  ] = useState(null);


  useEffect(() => {
    let cancelled =
      false;

    async function checkRhi() {
      setRhiChecking(true);
      setRhiError(null);

      try {
        const result =
          await getRhiStatus();

        if (cancelled) {
          return;
        }

        setRhiInstalled(
          result?.installed ??
          false
        );

        setRhiPath(
          result?.path ??
          null
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "[RHI] Status check failed:",
          error
        );

        setRhiInstalled(false);

        setRhiError(
          String(error)
        );
      } finally {
        if (!cancelled) {
          setRhiChecking(false);
        }
      }
    }

    checkRhi();

    return () => {
      cancelled =
        true;
    };
  }, []);


  async function handleLaunchRhi() {
    if (
      !rhiInstalled ||
      !available ||
      rhiLaunching
    ) {
      return;
    }

    setRhiLaunching(true);
    setRhiError(null);

    try {
      await launchRhi();
    } catch (error) {
      console.error(
        "[RHI] Launch failed:",
        error
      );

      setRhiError(
        String(error)
      );
    } finally {
      setRhiLaunching(false);
    }
  }


async function handleViewMods() {
  try {
    await openUrl(
      "https://github.com/clshortfuse/renodx/wiki/Mods"
    );
  } catch (error) {
    console.error(
      "[RenoDX] Failed to open mods page:",
      error
    );
  }
}


  let rhiButtonText =
    "RHI Not Found";

  if (rhiChecking) {
    rhiButtonText =
      "Checking RHI...";
  } else if (!rhiInstalled) {
    rhiButtonText =
      "RHI Not Found";
  } else if (!available) {
    rhiButtonText =
      "RenoDX Not Available";
  } else if (rhiLaunching) {
    rhiButtonText =
      "Launching...";
  } else {
    rhiButtonText =
      "Launch RHI";
  }


  const rhiDisabled =
    rhiChecking ||
    rhiLaunching ||
    !rhiInstalled ||
    !available;


  let rhiTitle =
    "Launch ReShade HDR Installer";

  if (rhiChecking) {
    rhiTitle =
      "Checking for ReShade HDR Installer";
  } else if (!rhiInstalled) {
    rhiTitle =
      "ReShade HDR Installer was not found";
  } else if (!available) {
    rhiTitle =
      "RHI can only be launched when a RenoDX mod is available for this game";
  }


  return (
    <div
      className="
        rounded-xl
        border
        border-white/10
        bg-white/[0.025]
        p-5
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
        "
      >
        <div
          className="
            flex
            items-start
            gap-4
          "
        >
          <div
            className="
              flex
              h-12
              w-12
              shrink-0
              items-center
              justify-center
              rounded-xl
              bg-violet-500/10
              text-violet-300
            "
          >
            <Sparkles
              className="h-6 w-6"
            />
          </div>

          <div>
            <h3
              className="
                text-base
                font-semibold
                text-white
              "
            >
              RenoDX
            </h3>

            <p
              className="
                mt-1
                text-sm
                text-white/40
              "
            >
              HDR enhancement and
              game modification support
            </p>
          </div>
        </div>

        {game?.renodxLoading ? (
          <div
            className="
              inline-flex
              items-center
              gap-2
              rounded-full
              border
              border-white/10
              bg-white/[0.04]
              px-2.5
              py-1
              text-xs
              text-white/45
            "
          >
            <Loader2
              className="
                h-3.5
                w-3.5
                animate-spin
              "
            />

            Checking
          </div>
        ) : (
          <StatusBadge
            renodx={
              renodx
            }
          />
        )}
      </div>


      {game?.renodxError ? (
        <div
          className="
            mt-5
            rounded-lg
            border
            border-red-500/20
            bg-red-500/[0.06]
            px-4
            py-3
            text-sm
            text-red-300
          "
        >
          {game.renodxError}
        </div>
      ) : null}


      {!game?.renodxLoading &&
      !game?.renodxError ? (
        <div
          className="
            mt-5
          "
        >
          <DetailRow
            label="Matched Game"
            value={
              renodx?.matchedName
            }
          />

          <DetailRow
            label="Category"
            value={
              renodx?.category
            }
          />

          <DetailRow
            label="Notes"
            value={
              renodx?.notes
            }
          />
        </div>
      ) : null}


      {rhiError ? (
        <div
          className="
            mt-4
            rounded-lg
            border
            border-red-500/20
            bg-red-500/[0.06]
            px-4
            py-3
            text-xs
            leading-relaxed
            text-red-300
          "
        >
          {rhiError}
        </div>
      ) : null}


      <div
        className="
          mt-5
          flex
          flex-wrap
          gap-3
        "
      >
        <button
          type="button"
          onClick={
            handleViewMods
          }
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-white/10
            bg-white/[0.04]
            px-4
            py-2
            text-sm
            font-medium
            text-white/75
            transition
            hover:border-white/20
            hover:bg-white/[0.08]
            hover:text-white
          "
        >
          <ExternalLink
            className="h-4 w-4"
          />

          View Mods
        </button>


        <button
          type="button"
          onClick={
            handleLaunchRhi
          }
          disabled={
            rhiDisabled
          }
          title={
            rhiTitle
          }
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-violet-500/20
            bg-violet-500/10
            px-4
            py-2
            text-sm
            font-medium
            text-violet-200
            transition
            hover:border-violet-500/30
            hover:bg-violet-500/15
            disabled:cursor-not-allowed
            disabled:border-white/[0.06]
            disabled:bg-white/[0.025]
            disabled:text-white/25
          "
        >
          {rhiChecking ||
          rhiLaunching ? (
            <Loader2
              className="
                h-4
                w-4
                animate-spin
              "
            />
          ) : (
            <Play
              className="h-4 w-4"
            />
          )}

          {rhiButtonText}
        </button>
      </div>


      {rhiInstalled &&
      rhiPath ? (
        <div
          className="
            mt-3
            truncate
            text-[11px]
            text-white/20
          "
          title={
            rhiPath
          }
        >
          RHI: {rhiPath}
        </div>
      ) : null}
    </div>
  );
}