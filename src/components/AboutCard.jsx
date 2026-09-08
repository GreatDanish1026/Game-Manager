import {
  BadgeInfo,
  ExternalLink,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getName,
  getVersion,
} from "@tauri-apps/api/app";

import {
  openUrl,
} from "@tauri-apps/plugin-opener";

const REPOSITORY_URL =
  "https://github.com/GreatDanish1026/Game-Manager";

export default function AboutCard({
  onCheckForUpdates,
  updateCheckStatus,
}) {
  const [
    appName,
    setAppName,
  ] =
    useState(
      "Game Manager"
    );

  const [
    version,
    setVersion,
  ] =
    useState(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(
    () => {
      let active = true;

      Promise.allSettled([
        getName(),
        getVersion(),
      ])
        .then(
          ([
            nameResult,
            versionResult,
          ]) => {
            if (!active) {
              return;
            }

            if (
              nameResult.status
              === "fulfilled"
              && nameResult.value
            ) {
              setAppName(
                nameResult.value
              );
            }

            if (
              versionResult.status
              === "fulfilled"
              && versionResult.value
            ) {
              setVersion(
                versionResult.value
              );
            }
          }
        )
        .finally(
          () => {
            if (active) {
              setLoading(false);
            }
          }
        );

      return () => {
        active = false;
      };
    },
    []
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
          flex-col
          gap-4
          sm:flex-row
          sm:items-center
          sm:justify-between
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
              text-cyan-300/75
            "
          >
            <BadgeInfo
              className="h-4 w-4"
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/72
              "
            >
              {appName}
            </div>

            <div
              className="
                mt-1
                flex
                items-center
                gap-2
                text-xs
                text-white/30
              "
            >
              {loading ? (
                <>
                  <Loader2
                    className="
                      h-3
                      w-3
                      animate-spin
                    "
                  />

                  Reading version…
                </>
              ) : (
                <>
                  Version {
                    version
                    ?? "Unknown"
                  }
                </>
              )}
            </div>
          </div>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              onCheckForUpdates
            }
            disabled={
              !onCheckForUpdates
              || updateCheckStatus
                ?.state
                === "checking"
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              px-3
              py-2
              text-xs
              text-white/45
              hover:bg-white/[0.06]
              hover:text-white/75
              disabled:cursor-not-allowed
              disabled:opacity-35
            "
          >
            {updateCheckStatus
              ?.state
              === "checking" ? (
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

            Check for Updates
          </button>

          <button
            type="button"
            onClick={
              () =>
                openUrl(
                  REPOSITORY_URL
                )
            }
            className="
              inline-flex
              items-center
              justify-center
              gap-2
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              px-3
              py-2
              text-xs
              text-white/45
              hover:bg-white/[0.06]
              hover:text-white/75
            "
          >
            <ExternalLink
              className="h-3.5 w-3.5"
            />

            GitHub
          </button>
        </div>
      </div>

      {updateCheckStatus
        ?.state
        && updateCheckStatus.state
          !== "idle"
        && updateCheckStatus.state
          !== "checking"
        ? (
        <div
          className={`
            mt-3
            flex
            items-start
            gap-2
            rounded-lg
            border
            px-3
            py-2
            text-[11px]
            leading-relaxed
            ${
              updateCheckStatus.state
                === "error"
                ? "border-red-500/15 bg-red-500/[0.035] text-red-200/55"
                : updateCheckStatus.state
                  === "available"
                  ? "border-cyan-500/15 bg-cyan-500/[0.035] text-cyan-100/55"
                  : "border-emerald-500/15 bg-emerald-500/[0.035] text-emerald-100/55"
            }
          `}
        >
          {updateCheckStatus.state
            === "error" ? (
            <AlertTriangle
              className="
                mt-0.5
                h-3.5
                w-3.5
                shrink-0
              "
            />
          ) : (
            <CheckCircle2
              className="
                mt-0.5
                h-3.5
                w-3.5
                shrink-0
              "
            />
          )}

          <span>
            {updateCheckStatus.message}
          </span>
        </div>
      ) : null}

      <div
        className="
          mt-3
          text-[11px]
          leading-relaxed
          text-white/22
        "
      >
        Version is read directly from the packaged Tauri application metadata.
        Automatic update checks are silent when the computer is offline; use Check for Updates for explicit status.
      </div>
    </div>
  );
}
