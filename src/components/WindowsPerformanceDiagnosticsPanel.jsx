import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Gauge,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  useState,
} from "react";

import {
  getWindowsPerformanceDiagnostics,
} from "../services/windowsPerformanceDiagnostics";


function CheckIcon({
  state,
}) {
  if (state === "warn") {
    return (
      <AlertTriangle
        className="
          mt-0.5
          h-4
          w-4
          shrink-0
          text-amber-300/85
        "
      />
    );
  }

  if (state === "pass") {
    return (
      <CheckCircle2
        className="
          mt-0.5
          h-4
          w-4
          shrink-0
          text-emerald-300/80
        "
      />
    );
  }

  return (
    <CircleHelp
      className="
        mt-0.5
        h-4
        w-4
        shrink-0
        text-cyan-300/65
      "
    />
  );
}


export default function WindowsPerformanceDiagnosticsPanel({
  game,
  isLinux = false,
}) {
  const [
    report,
    setReport,
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


  async function refresh() {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const result =
        await getWindowsPerformanceDiagnostics(
          game
        );

      setReport(
        result
      );
    } catch (loadError) {
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


  if (
    !loading
    && report
    && !report.supported
  ) {
    return null;
  }


  return (
    <div
      className="
        mt-5
        overflow-hidden
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-white/[0.06]
          p-4
          sm:flex-row
          sm:items-start
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
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-cyan-500/10
              text-cyan-300
            "
          >
            <Gauge
              className="h-5 w-5"
            />
          </div>

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/75
              "
            >
              System Performance Diagnostics
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
              Checks common system conditions that can contribute to
              stutter or inconsistent frametimes without claiming a
              single cause.
            </div>

            {report ? (
              <div
                className={`
                  mt-2
                  text-xs
                  ${
                    report.contributorCount > 0
                      ? "text-amber-200/70"
                      : "text-emerald-200/60"
                  }
                `}
              >
                {report.summary}
              </div>
            ) : null}
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
            items-center
            gap-2
            rounded-lg
            border
            border-white/10
            bg-white/[0.035]
            px-3
            py-2
            text-xs
            font-semibold
            text-white/55
            hover:bg-white/[0.07]
            disabled:opacity-40
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
            <RefreshCw
              className="h-3.5 w-3.5"
            />
          )}

          {report
            ? "Rescan"
            : "Run Scan"}
        </button>
      </div>


      {error ? (
        <div
          className="
            border-b
            border-red-500/10
            bg-red-500/[0.04]
            px-4
            py-3
            text-xs
            text-red-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {loading
        && !report ? (
        <div
          className="
            flex
            items-center
            gap-3
            p-4
            text-sm
            text-white/35
          "
        >
          <Loader2
            className="
              h-4
              w-4
              animate-spin
            "
          />

          Inspecting the {isLinux
            ? "Linux"
            : "Windows"} performance environment…
        </div>
      ) : null}


      {report ? (
        <>
          <div>
            {report.checks.map(
              (
                check
              ) => (
                <div
                  key={
                    check.key
                  }
                  className="
                    flex
                    items-start
                    gap-3
                    border-b
                    border-white/[0.055]
                    px-4
                    py-3
                    last:border-b-0
                  "
                >
                  <CheckIcon
                    state={
                      check.state
                    }
                  />

                  <div
                    className="
                      min-w-0
                      flex-1
                    "
                  >
                    <div
                      className={`
                        text-sm
                        font-medium
                        ${
                          check.state === "warn"
                            ? "text-amber-100/75"
                            : "text-white/68"
                        }
                      `}
                    >
                      {check.label}
                    </div>

                    <div
                      className="
                        mt-0.5
                        break-words
                        text-xs
                        leading-relaxed
                        text-white/32
                      "
                    >
                      {check.detail}
                    </div>

                    {check.suggestion ? (
                      <div
                        className="
                          mt-1.5
                          text-xs
                          leading-relaxed
                          text-cyan-100/45
                        "
                      >
                        Suggested:{" "}
                        {check.suggestion}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            )}
          </div>

          <div
            className="
              border-t
              border-white/[0.06]
              px-4
              py-3
              text-[10px]
              leading-relaxed
              text-white/22
            "
          >
            These checks identify possible contributors, not proven
            causes. Shader compilation, game-engine behavior, patches,
            drivers, thermals, and title-specific issues can still
            affect frametimes even when every check passes.
          </div>
        </>
      ) : null}
    </div>
  );
}
