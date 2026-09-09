import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  RefreshCcw,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getLauncherStatus,
} from "../services/launcherStatus";


export default function LauncherStatusPanel() {
  const [
    launchers,
    setLaunchers,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState(null);


  async function refresh() {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const result =
        await getLauncherStatus();

      setLaunchers(
        Array.isArray(result)
          ? result
          : []
      );
    } catch (statusError) {
      setError(
        String(statusError)
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      refresh();
    },
    []
  );


  const available =
    launchers.filter(
      (launcher) =>
        launcher.installed
    ).length;


  return (
    <section
      className="
        rounded-2xl
        border
        border-white/[0.08]
        bg-black/10
        p-5
      "
    >
      <div
        className="
          flex
          flex-col
          gap-4
          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        <div>
          <div
            className="
              text-base
              font-semibold
              text-white/80
            "
          >
            Game Launchers
          </div>

          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            {loading
              ? "Checking installed launchers…"
              : `${available} of ${launchers.length || 4} supported launchers detected.`}
          </div>
        </div>

        <button
          type="button"
          onClick={
            refresh
          }
          disabled={
            loading
          }
          className="
            inline-flex
            w-full
            items-center
            justify-center
            gap-1.5
            sm:w-auto
            rounded-lg
            border
            border-white/[0.08]
            bg-white/[0.025]
            px-2.5
            py-1.5
            text-[10px]
            font-semibold
            text-white/50
            transition
            hover:bg-white/[0.06]
            hover:text-white/75
            disabled:opacity-30
          "
        >
          {loading ? (
            <LoaderCircle
              className="
                h-3.5
                w-3.5
                animate-spin
              "
            />
          ) : (
            <RefreshCcw
              className="
                h-3.5
                w-3.5
              "
            />
          )}

          Refresh
        </button>
      </div>


      {error ? (
        <div
          className="
            mt-4
            rounded-xl
            border
            border-amber-500/15
            bg-amber-500/[0.04]
            px-3
            py-2.5
            text-xs
            text-amber-200/70
          "
        >
          Launcher detection failed: {error}
        </div>
      ) : null}


      <div
        className="
          mt-4
          grid
          grid-cols-1
          gap-2
          xl:grid-cols-2
        "
      >
        {!loading
          && !error
          && launchers.length === 0 ? (
          <div
            className="
              rounded-xl
              border
              border-white/[0.07]
              bg-white/[0.018]
              px-4
              py-5
              text-center
              text-xs
              text-white/30
              xl:col-span-2
            "
          >
            No supported launcher status is available yet. Use Refresh to check again.
          </div>
        ) : null}

        {launchers.map(
          (launcher) => (
            <div
              key={
                launcher.id
              }
              className="
                rounded-xl
                border
                border-white/[0.07]
                bg-white/[0.018]
                p-3
              "
            >
              <div
                className="
                  flex
                  items-start
                  gap-3
                "
              >
                {launcher.installed ? (
                  <CheckCircle2
                    className="
                      mt-0.5
                      h-4
                      w-4
                      shrink-0
                      text-emerald-300/75
                    "
                  />
                ) : (
                  <CircleAlert
                    className="
                      mt-0.5
                      h-4
                      w-4
                      shrink-0
                      text-amber-300/75
                    "
                  />
                )}

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
                      justify-between
                      gap-2
                    "
                  >
                    <span
                      className="
                        text-sm
                        font-semibold
                        text-white/68
                      "
                    >
                      {launcher.label}
                    </span>

                    <span
                      className={`
                        rounded-full
                        px-2
                        py-0.5
                        text-[9px]
                        font-semibold
                        uppercase
                        tracking-wide
                        ${
                          launcher.installed
                            ? "bg-emerald-500/[0.08] text-emerald-200/70"
                            : "bg-amber-500/[0.08] text-amber-200/70"
                        }
                      `}
                    >
                      {launcher.installed
                        ? "Available"
                        : "Not Detected"}
                    </span>
                  </div>

                  <div
                    className="
                      mt-1
                      text-[10px]
                      leading-relaxed
                      text-white/28
                    "
                  >
                    {launcher.message}
                  </div>

                  <div
                    className="
                      mt-1
                      truncate
                      text-[9px]
                      text-white/18
                    "
                    title={
                      launcher.path
                      ?? launcher.launchMethod
                    }
                  >
                    {launcher.path
                      ?? launcher.launchMethod}
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
