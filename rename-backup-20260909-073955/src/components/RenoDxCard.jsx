import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Play,
  Sparkles,
  Wrench,
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


const RENODX_MODS_URL =
  "https://github.com/clshortfuse/renodx/wiki/Mods";

const LUMA_MODS_URL =
  "https://github.com/Filoppi/Luma-Framework/wiki/Mods-List";


function getStatusDisplay(
  source
) {
  if (!source?.found) {
    return {
      label:
        "Not Found",

      state:
        "unavailable",
    };
  }

  const status =
    source.status
      ?.trim()
      .toLowerCase();


  if (
    status === "working"
  ) {
    return {
      label:
        "Working",

      state:
        "available",
    };
  }


  if (
    status === "in_progress"
  ) {
    return {
      label:
        "In Progress",

      state:
        "progress",
    };
  }


  if (
    status === "planned"
  ) {
    return {
      label:
        "Planned",

      state:
        "planned",
    };
  }


  if (
    status === "incompatible"
  ) {
    return {
      label:
        "Not Compatible",

      state:
        "unavailable",
    };
  }


  if (
    status === "listed"
  ) {
    return {
      label:
        "Listed",

      state:
        "listed",
    };
  }


  return {
    label:
      "Unknown",

    state:
      "unknown",
  };
}


function SourceStatusBadge({
  source,
}) {
  const status =
    getStatusDisplay(
      source
    );


  if (
    status.state ===
    "available"
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
    status.state ===
      "progress" ||
    status.state ===
      "listed" ||
    status.state ===
      "planned"
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
      <X
        className="h-3.5 w-3.5"
      />

      {status.label}
    </div>
  );
}


function ModSourceCard({
  title,
  source,
  accent = "cyan",
  onOpenPage,
  onDownload,
}) {
  const found =
    source?.found ??
    false;


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
          justify-between
          gap-3
        "
      >
        <div
          className="
            flex
            items-center
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
                accent === "violet"
                  ? "bg-violet-500/10 text-violet-300"
                  : "bg-cyan-500/10 text-cyan-300"
              }
            `}
          >
            {accent === "violet" ? (
              <Sparkles
                className="h-4 w-4"
              />
            ) : (
              <Wrench
                className="h-4 w-4"
              />
            )}
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white
              "
            >
              {title}
            </div>

            {source?.matchedName ? (
              <div
                className="
                  mt-0.5
                  text-xs
                  text-white/40
                "
              >
                {source.matchedName}
              </div>
            ) : null}
          </div>
        </div>


        <SourceStatusBadge
          source={
            source
          }
        />
      </div>


      {source?.category ? (
        <div
          className="
            mt-4
            text-xs
            text-white/40
          "
        >
          Category:{" "}
          <span
            className="
              text-white/65
            "
          >
            {source.category}
          </span>
        </div>
      ) : null}


      {source?.notes ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-white/[0.06]
            bg-white/[0.025]
            px-3
            py-2.5
            text-xs
            leading-relaxed
            text-white/55
          "
        >
          {source.notes}
        </div>
      ) : null}


      <div
        className="
          mt-4
          flex
          flex-wrap
          gap-2
        "
      >
        <button
          type="button"
          onClick={
            onOpenPage
          }
          className="
            inline-flex
            items-center
            gap-2
            rounded-lg
            border
            border-white/10
            bg-white/[0.04]
            px-3
            py-2
            text-xs
            font-medium
            text-white/65
            transition
            hover:bg-white/[0.08]
            hover:text-white
          "
        >
          <ExternalLink
            className="h-3.5 w-3.5"
          />

          View Mods
        </button>


        {found &&
        source?.downloadUrl ? (
          <button
            type="button"
            onClick={
              onDownload
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-emerald-500/20
              bg-emerald-500/[0.07]
              px-3
              py-2
              text-xs
              font-medium
              text-emerald-300
              transition
              hover:bg-emerald-500/10
            "
          >
            <Download
              className="h-3.5 w-3.5"
            />

            Open Download
          </button>
        ) : null}
      </div>
    </div>
  );
}


export default function RenoDxCard({
  game,
}) {
  const hdrMods =
    game?.renodx ?? {};


  const renodx =
    hdrMods?.renodx ?? {
      found: false,
      available: false,
    };


  const luma =
    hdrMods?.luma ?? {
      found: false,
      available: false,
    };


  /*
   * RHI can be used when either framework has
   * an actual usable mod.
   *
   * Planned Luma entries do not qualify.
   * In-progress entries do.
   */
  const modAvailable =
    renodx.available ||
    luma.available;


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
      !modAvailable ||
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


  async function openExternal(
    url
  ) {
    if (!url) {
      return;
    }

    try {
      await openUrl(url);
    } catch (error) {
      console.error(
        "[HDR Mods] Failed to open URL:",
        error
      );
    }
  }


  const rhiDisabled =
    rhiChecking ||
    rhiLaunching ||
    !rhiInstalled ||
    !modAvailable;


  let rhiButtonText =
    "Launch RHI";


  if (rhiChecking) {
    rhiButtonText =
      "Checking RHI...";
  } else if (!rhiInstalled) {
    rhiButtonText =
      "RHI Not Found";
  } else if (!modAvailable) {
    rhiButtonText =
      "No Usable HDR Mod";
  } else if (rhiLaunching) {
    rhiButtonText =
      "Launching...";
  }


  let availabilityText =
    "No supported RenoDX or Luma mod was found.";


  if (
    renodx.available &&
    luma.available
  ) {
    availabilityText =
      "Both RenoDX and Luma Framework mods are available for this game.";
  } else if (
    renodx.available
  ) {
    availabilityText =
      "A RenoDX mod is available for this game.";
  } else if (
    luma.available
  ) {
    availabilityText =
      "A Luma Framework mod is available for this game.";
  } else if (
    luma.found &&
    luma.status === "planned"
  ) {
    availabilityText =
      "A Luma Framework mod is planned, but it is not available yet.";
  } else if (
    luma.found &&
    luma.status === "incompatible"
  ) {
    availabilityText =
      "The game is listed by Luma Framework, but the current implementation is marked incompatible.";
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
          flex-col
          gap-4
          lg:flex-row
          lg:items-start
          lg:justify-between
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
              HDR Mod Support
            </h3>

            <p
              className="
                mt-1
                max-w-2xl
                text-sm
                leading-relaxed
                text-white/40
              "
            >
              Checks RenoDX and Luma Framework
              for HDR and graphics enhancement
              mods compatible with this game.
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
        ) : modAvailable ? (
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

            Mod Available
          </div>
        ) : (
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
            <X
              className="h-3.5 w-3.5"
            />

            No Usable Mod
          </div>
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
        <>
          <div
            className="
              mt-5
              rounded-lg
              border
              border-white/[0.06]
              bg-white/[0.02]
              px-4
              py-3
              text-sm
              text-white/55
            "
          >
            {availabilityText}
          </div>


          <div
            className="
              mt-4
              grid
              grid-cols-1
              gap-4
              xl:grid-cols-2
            "
          >
            <ModSourceCard
              title="RenoDX"
              source={
                renodx
              }
              accent="violet"

              onOpenPage={() =>
                openExternal(
                  renodx.pageUrl ??
                  RENODX_MODS_URL
                )
              }

              onDownload={() =>
                openExternal(
                  renodx.downloadUrl
                )
              }
            />


            <ModSourceCard
              title="Luma Framework"
              source={
                luma
              }
              accent="cyan"

              onOpenPage={() =>
                openExternal(
                  luma.pageUrl ??
                  LUMA_MODS_URL
                )
              }

              onDownload={() =>
                openExternal(
                  luma.downloadUrl
                )
              }
            />
          </div>
        </>
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
          items-center
          gap-3
        "
      >
        <button
          type="button"
          onClick={
            handleLaunchRhi
          }
          disabled={
            rhiDisabled
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


        {modAvailable ? (
          <span
            className="
              text-xs
              text-white/30
            "
          >
            RHI can be used with the detected
            HDR mod.
          </span>
        ) : null}
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