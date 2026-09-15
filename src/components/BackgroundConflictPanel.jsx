import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Layers3,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  getBackgroundConflictReport,
} from "../services/backgroundConflicts";


function FindingIcon({
  severity,
}) {
  if (severity === "warning") {
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

  if (severity === "good") {
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


function AppCard({
  app,
}) {
  const hookCapable =
    app.impact
    === "hook-capable";

  const monitoring =
    app.impact
    === "monitoring";

  return (
    <div
      className={`
        rounded-lg
        border
        px-3
        py-3
        ${
          hookCapable
            ? "border-amber-400/15 bg-amber-400/[0.035]"
            : monitoring
              ? "border-cyan-400/12 bg-cyan-400/[0.03]"
              : "border-white/[0.07] bg-black/10"
        }
      `}
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
            min-w-0
          "
        >
          <div
            className="
              text-xs
              font-semibold
              text-white/72
            "
          >
            {app.name}
          </div>

          <div
            className="
              mt-1
              text-[10px]
              text-white/28
            "
          >
            {app.category}
          </div>

          <div
            className="
              mt-1.5
              text-xs
              leading-relaxed
              text-white/35
            "
          >
            {app.note}
          </div>

          <div
            className="
              mt-1
              break-all
              text-[10px]
              text-white/20
            "
          >
            {app.processName}
          </div>
        </div>

        <span
          className={`
            shrink-0
            rounded-full
            border
            px-2
            py-0.5
            text-[10px]
            ${
              hookCapable
                ? "border-amber-400/15 bg-amber-400/[0.05] text-amber-200/65"
                : "border-white/[0.08] bg-white/[0.03] text-white/35"
            }
          `}
        >
          {hookCapable
            ? "Hook-capable"
            : monitoring
              ? "Monitoring"
              : "Background"
          }
        </span>
      </div>
    </div>
  );
}


export default function BackgroundConflictPanel() {
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
        await getBackgroundConflictReport();

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


  const warningCount =
    useMemo(
      () =>
        report?.findings
          ?.filter(
            (finding) =>
              finding.severity
              === "warning"
          )
          .length
        ?? 0,
      [
        report,
      ]
    );


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
              bg-violet-500/10
              text-violet-300
            "
          >
            <Layers3
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
              Overlay & Background-App Conflicts
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
              Detects common overlays, capture tools, monitoring apps,
              RGB utilities, and system-control software that may be
              useful to isolate during troubleshooting.
            </div>

            {report ? (
              <div
                className={`
                  mt-2
                  text-xs
                  ${
                    warningCount > 0
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

          Inspecting running Windows background applications…
        </div>
      ) : null}


      {report ? (
        <>
          <div
            className="
              border-b
              border-white/[0.06]
              p-4
            "
          >
            <div
              className="
                mb-3
                flex
                items-center
                justify-between
                gap-3
              "
            >
              <div
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-white/30
                "
              >
                Running Recognized Apps
              </div>

              <div
                className="
                  text-[10px]
                  text-white/25
                "
              >
                {report.hookCapableCount} hook-capable
              </div>
            </div>

            {report.runningApps.length > 0 ? (
              <div
                className="
                  grid
                  grid-cols-1
                  gap-2
                  md:grid-cols-2
                  xl:grid-cols-3
                "
              >
                {report.runningApps.map(
                  (app) => (
                    <AppCard
                      key={
                        `${app.name}-${app.processName}`
                      }
                      app={
                        app
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div
                className="
                  rounded-lg
                  border
                  border-dashed
                  border-white/[0.08]
                  px-3
                  py-4
                  text-xs
                  text-white/30
                "
              >
                No recognized overlay, capture, monitoring, RGB, or
                system-control applications are currently running.
              </div>
            )}
          </div>


          <div
            className="
              p-4
            "
          >
            <div
              className="
                mb-3
                text-xs
                font-semibold
                uppercase
                tracking-wide
                text-white/30
              "
            >
              Findings
            </div>

            <div
              className="
                space-y-2
              "
            >
              {report.findings.map(
                (
                  finding,
                  index
                ) => (
                  <div
                    key={
                      `${finding.title}-${index}`
                    }
                    className={`
                      flex
                      items-start
                      gap-3
                      rounded-lg
                      border
                      px-3
                      py-3
                      ${
                        finding.severity === "warning"
                          ? "border-amber-400/15 bg-amber-400/[0.04]"
                          : finding.severity === "good"
                            ? "border-emerald-400/12 bg-emerald-400/[0.035]"
                            : "border-cyan-400/10 bg-cyan-400/[0.03]"
                      }
                    `}
                  >
                    <FindingIcon
                      severity={
                        finding.severity
                      }
                    />

                    <div
                      className="
                        min-w-0
                      "
                    >
                      <div
                        className="
                          text-xs
                          font-semibold
                          text-white/70
                        "
                      >
                        {finding.title}
                      </div>

                      <div
                        className="
                          mt-1
                          text-xs
                          leading-relaxed
                          text-white/38
                        "
                      >
                        {finding.detail}
                      </div>

                      {finding.suggestion ? (
                        <div
                          className="
                            mt-1.5
                            text-xs
                            leading-relaxed
                            text-cyan-100/45
                          "
                        >
                          Suggested:{" "}
                          {finding.suggestion}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              )}
            </div>
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
            A running application is not automatically a conflict.
            GameAtlas highlights combinations worth testing when
            troubleshooting crashes, input issues, presentation
            problems, or inconsistent frametimes.
          </div>
        </>
      ) : null}
    </div>
  );
}
