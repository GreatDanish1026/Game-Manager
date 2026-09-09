import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

function formatBytes(value) {
  if (
    !Number.isFinite(value)
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

  let amount = value;
  let index = 0;

  while (
    amount >= 1024
    && index < units.length - 1
  ) {
    amount /= 1024;
    index += 1;
  }

  return `${amount.toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

export default function UpdateNotification({
  update,
  onDismiss,
}) {
  const [
    installing,
    setInstalling,
  ] =
    useState(false);

  const [
    installed,
    setInstalled,
  ] =
    useState(false);

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
            (downloaded / total)
            * 100
          )
        );
      },
      [
        downloaded,
        total,
      ]
    );

  async function installUpdate() {
    if (
      !update
      || installing
      || installed
    ) {
      return;
    }

    setInstalling(true);
    setError(null);
    setDownloaded(0);
    setTotal(null);

    try {
      await update.downloadAndInstall(
        (event) => {
          if (
            event.event
            === "Started"
          ) {
            const length =
              event.data
                ?.contentLength;

            if (
              Number.isFinite(length)
            ) {
              setTotal(length);
            }

            return;
          }

          if (
            event.event
            === "Progress"
          ) {
            const chunk =
              event.data
                ?.chunkLength;

            if (
              Number.isFinite(chunk)
            ) {
              setDownloaded(
                (current) =>
                  current + chunk
              );
            }
          }
        }
      );

      setInstalled(true);
    } catch (error) {
      console.error(
        "[Updater] Install failed:",
        error
      );

      setError(
        String(error)
      );
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div
      className="
        fixed
        bottom-5
        right-5
        z-50
        w-[390px]
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
                ? "Update Installed"
                : error
                  ? "Update Failed"
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
                {" "}was installed. Close and reopen GameAtlas to use the new version.
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
              </>
            )}
          </div>

          {!installed
            && update.body ? (
            <div
              className="
                mt-3
                max-h-28
                overflow-y-auto
                whitespace-pre-wrap
                text-xs
                leading-relaxed
                text-white/40
              "
            >
              {update.body}
            </div>
          ) : null}

          {installing ? (
            <div className="mt-4">
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                  text-[11px]
                  text-white/30
                "
              >
                <span>
                  Downloading and installing…
                </span>

                <span className="tabular-nums">
                  {progress !== null
                    ? `${progress}%`
                    : formatBytes(downloaded)
                      ?? "Working…"}
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
                  className="
                    h-full
                    rounded-full
                    bg-cyan-400/70
                    transition-all
                  "
                  style={{
                    width:
                      progress !== null
                        ? `${progress}%`
                        : "24%",
                  }}
                />
              </div>
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
            {!installed ? (
              <button
                type="button"
                onClick={
                  installUpdate
                }
                disabled={
                  installing
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
                {installing ? (
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
                  : installing
                    ? "Installing…"
                    : "Install Update"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={
                onDismiss
              }
              disabled={
                installing
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
                disabled:opacity-35
              "
            >
              {installed
                ? "Close"
                : "Later"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onDismiss
          }
          disabled={
            installing
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
