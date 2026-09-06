import {
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  CircleHelp,
  Construction,
  ExternalLink,
  Gamepad2,
  MonitorUp,
} from "lucide-react";

import {
  getRhiStatus,
  launchRhi,
} from "../services/rhi";

export default function RenoDxCard({
  game,
}) {
  const renodx =
    game?.renodx;

  const [
    rhiInstalled,
    setRhiInstalled,
  ] =
    useState(false);

  const [
    rhiChecking,
    setRhiChecking,
  ] =
    useState(true);

  const [
    rhiLaunching,
    setRhiLaunching,
  ] =
    useState(false);

  const [
    rhiError,
    setRhiError,
  ] =
    useState(null);

  // =========================================================
  // Check for ReShade HDR Installer
  // =========================================================

  useEffect(() => {
    let active = true;

    async function checkRhi() {
      setRhiChecking(true);
      setRhiError(null);

      try {
        const status =
          await getRhiStatus();

        if (!active) {
          return;
        }

        setRhiInstalled(
          status.installed
        );
      } catch (error) {
        console.error(
          "[RHI] Status check failed:",
          error
        );

        if (!active) {
          return;
        }

        setRhiInstalled(false);

        setRhiError(
          "Could not check RHI installation."
        );
      } finally {
        if (active) {
          setRhiChecking(false);
        }
      }
    }

    checkRhi();

    return () => {
      active = false;
    };
  }, []);

  // =========================================================
  // Launch RHI
  // =========================================================

  async function handleLaunchRhi() {
    if (
      !rhiInstalled ||
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

      // Check again in case the executable
      // was removed after the first check.
      try {
        const status =
          await getRhiStatus();

        setRhiInstalled(
          status.installed
        );
      } catch {
        setRhiInstalled(false);
      }
    } finally {
      setRhiLaunching(false);
    }
  }

  // =========================================================
  // RenoDX loading state
  // =========================================================

  if (game?.renodxLoading) {
    return (
      <div
        className="
          rounded-xl
          border border-white/[0.06]
          bg-white/[0.025]
          p-5
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
            className="
              flex h-10 w-10
              items-center
              justify-center
              rounded-lg
              bg-sky-500/10
              text-sky-400
            "
          >
            <Gamepad2
              size={20}
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white
              "
            >
              RenoDX
            </div>

            <div
              className="
                mt-0.5
                text-xs
                text-gray-500
              "
            >
              Checking compatibility...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RenoDX error state
  // =========================================================

  if (game?.renodxError) {
    return (
      <div
        className="
          rounded-xl
          border border-amber-500/10
          bg-amber-500/[0.04]
          p-5
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <CircleHelp
            size={20}
            className="
              text-amber-400
            "
          />

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white
              "
            >
              RenoDX
            </div>

            <div
              className="
                mt-1
                text-xs
                text-amber-300
              "
            >
              {game.renodxError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // Determine RenoDX status
  // =========================================================

  const status =
    renodx?.status;

  const working =
    status === "working";

  const inProgress =
    status ===
    "in_progress";

  const listed =
    status === "listed";

  const available =
    working ||
    inProgress ||
    listed;

  let Icon =
    CircleHelp;

  let statusText =
    "Not Listed";

  let iconClass =
    "bg-gray-500/10 text-gray-400";

  let badgeClass =
    "border-gray-500/10 bg-gray-500/10 text-gray-400";

  if (working) {
    Icon =
      CheckCircle2;

    statusText =
      "Available";

    iconClass =
      "bg-emerald-500/10 text-emerald-400";

    badgeClass =
      "border-emerald-500/10 bg-emerald-500/10 text-emerald-400";
  } else if (
    inProgress
  ) {
    Icon =
      Construction;

    statusText =
      "In Progress";

    iconClass =
      "bg-amber-500/10 text-amber-400";

    badgeClass =
      "border-amber-500/10 bg-amber-500/10 text-amber-400";
  } else if (
    listed
  ) {
    Icon =
      CheckCircle2;

    statusText =
      "Listed";

    iconClass =
      "bg-sky-500/10 text-sky-400";

    badgeClass =
      "border-sky-500/10 bg-sky-500/10 text-sky-400";
  }

  // =========================================================
  // RHI button text
  // =========================================================

  let rhiButtonText =
  "RHI Not Found";

if (rhiChecking) {
  rhiButtonText =
    "Checking RHI...";
} else if (
  !rhiInstalled
) {
  rhiButtonText =
    "RHI Not Found";
} else if (
  !available
) {
  rhiButtonText =
    "RenoDX Not Available";
} else if (
  rhiLaunching
) {
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

  // =========================================================
  // Render
  // =========================================================

  return (
    <div
      className="
        rounded-xl
        border border-white/[0.06]
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
            gap-3
          "
        >
          <div
            className={`
              flex h-10 w-10
              shrink-0
              items-center
              justify-center
              rounded-lg
              ${iconClass}
            `}
          >
            <Icon
              size={20}
            />
          </div>

          <div>
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
                  text-white
                "
              >
                RenoDX
              </div>

              <span
                className={`
                  rounded-full
                  border
                  px-2
                  py-0.5
                  text-[10px]
                  font-medium
                  uppercase
                  tracking-wide
                  ${badgeClass}
                `}
              >
                {statusText}
              </span>
            </div>

            {available ? (
              <>
                <div
                  className="
                    mt-2
                    text-sm
                    text-gray-300
                  "
                >
                  RenoDX support is listed
                  for this game.
                </div>

                {renodx
                  ?.matchedName && (
                  <div
                    className="
                      mt-2
                      text-xs
                      text-gray-500
                    "
                  >
                    Match:{" "}
                    <span
                      className="
                        text-gray-400
                      "
                    >
                      {
                        renodx
                          .matchedName
                      }
                    </span>
                  </div>
                )}

                {renodx
                  ?.category && (
                  <div
                    className="
                      mt-1
                      text-xs
                      text-gray-500
                    "
                  >
                    Type:{" "}
                    <span
                      className="
                        text-gray-400
                      "
                    >
                      {
                        renodx
                          .category
                      }
                    </span>
                  </div>
                )}

                {renodx?.notes && (
                  <div
                    className="
                      mt-3
                      max-w-2xl
                      text-xs
                      leading-5
                      text-gray-500
                    "
                  >
                    {renodx.notes}
                  </div>
                )}
              </>
            ) : (
              <div
                className="
                  mt-2
                  text-sm
                  text-gray-500
                "
              >
                This game is not
                currently listed on the
                RenoDX Mods page.
              </div>
            )}

            {rhiError && (
              <div
                className="
                  mt-3
                  text-xs
                  text-red-400
                "
              >
                {rhiError}
              </div>
            )}
          </div>
        </div>

        {/* -----------------------------------------------
            Action buttons
        ------------------------------------------------ */}

        <div
          className="
            flex
            shrink-0
            items-center
            gap-2
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
title={
  !rhiInstalled
    ? "ReShade HDR Installer was not found"
    : !available
      ? "No RenoDX mod is available for this game"
      : "Open ReShade HDR Installer"
}
            className={`
              flex
              items-center
              gap-2
              rounded-lg
              border
              px-3
              py-2
              text-xs
              font-medium
              transition

              ${
                rhiDisabled
                  ? `
                    cursor-not-allowed
                    border-white/[0.04]
                    bg-white/[0.02]
                    text-gray-600
                  `
                  : `
                    border-sky-500/20
                    bg-sky-500/10
                    text-sky-300
                    hover:border-sky-400/30
                    hover:bg-sky-500/20
                    hover:text-sky-200
                  `
              }
            `}
          >
            <MonitorUp
              size={14}
            />

            {rhiButtonText}
          </button>

          {renodx?.pageUrl && (
            <button
              type="button"
              onClick={() => {
                window.open(
                  renodx.pageUrl,
                  "_blank"
                );
              }}
              className="
                flex
                items-center
                gap-2
                rounded-lg
                border border-white/[0.06]
                bg-white/[0.03]
                px-3
                py-2
                text-xs
                text-gray-400
                transition
                hover:bg-white/[0.06]
                hover:text-white
              "
            >
              <ExternalLink
                size={14}
              />

              View Mods
            </button>
          )}
        </div>
      </div>
    </div>
  );
}