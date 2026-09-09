import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  installUpdate,
  restartForUpdate,
} from "../services/updater";


function formatBytes(
  value
) {
  if (
    !Number.isFinite(
      value
    )
    || value <= 0
  ) {
    return null;
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  let amount =
    value;

  let index =
    0;

  while (
    amount >= 1024
    && index
      < units.length - 1
  ) {
    amount /=
      1024;

    index +=
      1;
  }

  return `${amount.toFixed(
    index === 0
      ? 0
      : 1
  )} ${units[index]}`;
}


function formatReleaseDate(
  value
) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(
      value
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(
      value
    );
  }

  return parsed
    .toLocaleDateString(
      undefined,
      {
        year:
          "numeric",

        month:
          "short",

        day:
          "numeric",
      }
    );
}


export default function UpdateNotification({
  update,
  onDismiss,
  onSkip,
}) {
  const [
    phase,
    setPhase,
  ] =
    useState(
      "ready"
    );

  const [
    error,
    setError,
  ] =
    useState(null);

  const [
    downloaded,
    setDownloaded,
  ] =
    useState(0);

  const [
    total,
    setTotal,
  ] =
    useState(null);

  const [
    releaseNotesExpanded,
    setReleaseNotesExpanded,
  ] =
    useState(true);

  const busy =
    phase === "downloading"
    || phase === "installing";

  const installed =
    phase === "installed";

  const progress =
    useMemo(
      () => {
        if (
          !total
          || total <= 0
        ) {
          return null;
        }

        return Math.min(
          100,
          Math.round(
            (
              downloaded
              / total
            )
            * 100
          )
        );
      },
      [
        downloaded,
        total,
      ]
    );

  const releaseDate =
    formatReleaseDate(
      update?.date
    );


  async function startInstall() {
    if (
      !update
      || busy
      || installed
    ) {
      return;
    }

    setError(
      null
    );

    setDownloaded(
      0
    );

    setTotal(
      null
    );

    setPhase(
      "downloading"
    );

    try {
      await installUpdate(
        update,
        (event) => {
          if (
            Number.isFinite(
              event.total
            )
            && event.total > 0
          ) {
            setTotal(
              event.total
            );
          }

          if (
            Number.isFinite(
              event.downloaded
            )
          ) {
            setDownloaded(
              event.downloaded
            );
          }

          if (
            event.state
            === "installing"
          ) {
            setPhase(
              "installing"
            );
          }

          if (
            event.state
            === "installed"
          ) {
            setPhase(
              "installed"
            );
          }
        }
      );

      setPhase(
        "installed"
      );
    } catch (installError) {
      console.error(
        "[Updater] Install failed:",
        installError
      );

      setError(
        String(
          installError
        )
      );

      setPhase(
        "ready"
      );
    }
  }


  async function restartNow() {
    setError(
      null
    );

    try {
      await restartForUpdate();
    } catch (restartError) {
      setError(
        `Could not restart GameAtlas: ${String(
          restartError
        )}`
      );
    }
  }


  return (
    <div
      className="
        fixed
        bottom-5
        right-5
        z-50
        w-[430px]
        max-w-[calc(100vw-2.5rem)]
        overflow-hidden
        rounded-xl
        border
        border-cyan-500/30
        bg-[#121923]
        shadow-2xl
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          p-4
        "
      >
        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            {installed ? (
              <CheckCircle2
                className="
                  h-4
                  w-4
                  text-emerald-300
                "
              />
            ) : error ? (
              <AlertTriangle
                className="
                  h-4
                  w-4
                  text-red-300
                "
              />
            ) : busy ? (
              <Loader2
                className="
                  h-4
                  w-4
                  animate-spin
                  text-cyan-300
                "
              />
            ) : (
              <Download
                className="
                  h-4
                  w-4
                  text-cyan-300
                "
              />
            )}

            <div
              className="
                text-sm
                font-semibold
                text-white
              "
            >
              {installed
                ? "Update Ready to Restart"
                : error
                  ? "Update Failed"
                  : phase === "installing"
                    ? "Installing Update"
                    : phase === "downloading"
                      ? "Downloading Update"
                      : "Update Available"}
            </div>
          </div>

          <div
            className="
              mt-2
              text-sm
              leading-relaxed
              text-white/65
            "
          >
            {installed ? (
              <>
                GameAtlas{" "}
                <span
                  className="
                    font-semibold
                    text-emerald-300
                  "
                >
                  {update.version}
                </span>
                {" "}is installed and ready. Restart GameAtlas to finish the update.
              </>
            ) : (
              <>
                GameAtlas{" "}
                <span
                  className="
                    font-semibold
                    text-cyan-300
                  "
                >
                  {update.version}
                </span>
                {" "}is available.
                {releaseDate
                  ? ` Released ${releaseDate}.`
                  : ""}
              </>
            )}
          </div>

          {!installed
            && update.body ? (
            <div
              className="
                mt-3
                overflow-hidden
                rounded-lg
                border
                border-white/[0.07]
                bg-black/15
              "
            >
              <button
                type="button"
                onClick={
                  () =>
                    setReleaseNotesExpanded(
                      (current) =>
                        !current
                    )
                }
                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  gap-3
                  px-3
                  py-2
                  text-left
                  text-[11px]
                  font-semibold
                  text-white/50
                  hover:bg-white/[0.025]
                "
              >
                <span>
                  What’s new in {update.version}
                </span>

                {releaseNotesExpanded ? (
                  <ChevronUp
                    className="h-3.5 w-3.5"
                  />
                ) : (
                  <ChevronDown
                    className="h-3.5 w-3.5"
                  />
                )}
              </button>

              {releaseNotesExpanded ? (
                <div
                  className="
                    max-h-44
                    overflow-y-auto
                    whitespace-pre-wrap
                    border-t
                    border-white/[0.06]
                    px-3
                    py-2.5
                    text-xs
                    leading-relaxed
                    text-white/40
                  "
                >
                  {update.body}
                </div>
              ) : null}
            </div>
          ) : null}

          {busy ? (
            <div
              className="mt-4"
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                  text-[11px]
                  text-white/35
                "
              >
                <span>
                  {phase === "installing"
                    ? "Download complete · installing…"
                    : "Downloading update…"}
                </span>

                <span
                  className="tabular-nums"
                >
                  {phase === "installing"
                    ? "Installing"
                    : progress !== null
                      ? `${progress}%`
                      : formatBytes(
                          downloaded
                        )
                        ?? "Starting…"}
                </span>
              </div>

              <div
                className="
                  mt-2
                  h-1.5
                  overflow-hidden
                  rounded-full
                  bg-white/[0.06]
                "
              >
                <div
                  className={`
                    h-full
                    rounded-full
                    bg-cyan-400/70
                    transition-all
                    ${
                      progress === null
                        || phase === "installing"
                        ? "animate-pulse"
                        : ""
                    }
                  `}
                  style={{
                    width:
                      phase === "installing"
                        ? "100%"
                        : progress !== null
                          ? `${progress}%`
                          : "24%",
                  }}
                />
              </div>

              {phase === "downloading"
                && total ? (
                <div
                  className="
                    mt-1.5
                    text-[10px]
                    tabular-nums
                    text-white/25
                  "
                >
                  {formatBytes(
                    downloaded
                  )}
                  {" / "}
                  {formatBytes(
                    total
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div
              className="
                mt-3
                rounded-lg
                border
                border-red-500/15
                bg-red-500/[0.035]
                px-3
                py-2
                text-[11px]
                leading-relaxed
                text-red-200/60
              "
            >
              {error}
            </div>
          ) : null}

          <div
            className="
              mt-4
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            {installed ? (
              <button
                type="button"
                onClick={
                  restartNow
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-emerald-500/15
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-emerald-200
                  hover:bg-emerald-500/22
                "
              >
                <RotateCcw
                  className="h-3.5 w-3.5"
                />

                Restart GameAtlas
              </button>
            ) : (
              <button
                type="button"
                onClick={
                  startInstall
                }
                disabled={
                  busy
                }
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-lg
                  bg-cyan-500/15
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-cyan-200
                  hover:bg-cyan-500/22
                  disabled:opacity-45
                "
              >
                {busy ? (
                  <Loader2
                    className="
                      h-3.5
                      w-3.5
                      animate-spin
                    "
                  />
                ) : (
                  <Download
                    className="h-3.5 w-3.5"
                  />
                )}

                {error
                  ? "Try Again"
                  : phase === "installing"
                    ? "Installing…"
                    : phase === "downloading"
                      ? "Downloading…"
                      : "Install Update"}
              </button>
            )}

            {!installed ? (
              <>
                <button
                  type="button"
                  onClick={
                    onDismiss
                  }
                  disabled={
                    busy
                  }
                  className="
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-white/[0.02]
                    px-3
                    py-2
                    text-xs
                    text-white/45
                    hover:bg-white/[0.05]
                    hover:text-white/70
                    disabled:opacity-35
                  "
                >
                  Remind Me Later
                </button>

                <button
                  type="button"
                  onClick={
                    onSkip
                  }
                  disabled={
                    busy
                  }
                  className="
                    rounded-lg
                    px-2
                    py-2
                    text-[11px]
                    text-white/25
                    hover:bg-white/[0.035]
                    hover:text-white/50
                    disabled:opacity-30
                  "
                >
                  Skip {update.version}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={
                  onDismiss
                }
                className="
                  rounded-lg
                  border
                  border-white/[0.08]
                  bg-white/[0.02]
                  px-3
                  py-2
                  text-xs
                  text-white/40
                  hover:bg-white/[0.05]
                  hover:text-white/65
                "
              >
                Restart Later
              </button>
            )}
          </div>

          {!installed
            && !busy ? (
            <div
              className="
                mt-2
                text-[10px]
                leading-relaxed
                text-white/20
              "
            >
              Remind Me Later dismisses this notice until GameAtlas is restarted.
              Skipping suppresses this exact version during automatic checks;
              manual update checks can still reveal it.
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={
            onDismiss
          }
          disabled={
            busy
          }
          aria-label="Dismiss update"
          className="
            flex
            h-7
            w-7
            shrink-0
            items-center
            justify-center
            rounded-lg
            text-white/25
            hover:bg-white/[0.05]
            hover:text-white/55
            disabled:opacity-30
          "
        >
          <X
            className="h-4 w-4"
          />
        </button>
      </div>
    </div>
  );
}
