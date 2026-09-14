import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getGraphicsDriverDiagnostics,
} from "../services/graphicsDriverDiagnostics";


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


export default function GraphicsDriverDiagnosticsPanel() {
  const [
    report,
    setReport,
  ] =
    useState(null);

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
      const next =
        await getGraphicsDriverDiagnostics();

      setReport(
        next
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


  useEffect(
    () => {
      refresh();
    },
    []
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
              bg-cyan-500/10
              text-cyan-300
            "
          >
            <ShieldCheck
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
              Graphics Driver Diagnostics
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
              Read-only Windows checks for installed display adapters,
              driver versions and dates, multi-vendor environments,
              device status, and driver-store consistency.
            </div>

            {report ? (
              <div
                className="
                  mt-2
                  text-xs
                  text-white/30
                "
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
          <RefreshCw
            className={`
              h-3.5
              w-3.5
              ${
                loading
                  ? "animate-spin"
                  : ""
              }
            `}
          />

          Rescan
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
            leading-relaxed
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

          Inspecting Windows graphics drivers…
        </div>
      ) : null}


      {report ? (
        <>
          <div
            className="
              grid
              grid-cols-1
              gap-3
              border-b
              border-white/[0.06]
              p-4
              lg:grid-cols-2
            "
          >
            {report.adapters.map(
              (
                adapter,
                index
              ) => (
                <div
                  key={
                    `${adapter.name}-${index}`
                  }
                  className="
                    rounded-lg
                    border
                    border-white/[0.07]
                    bg-black/10
                    p-3
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
                    <div>
                      <div
                        className="
                          text-sm
                          font-semibold
                          text-white/72
                        "
                      >
                        {adapter.name}
                      </div>

                      <div
                        className="
                          mt-1
                          text-[10px]
                          uppercase
                          tracking-wide
                          text-white/25
                        "
                      >
                        {adapter.vendor}
                      </div>
                    </div>

                    {adapter.status ? (
                      <span
                        className="
                          rounded-full
                          border
                          border-white/[0.08]
                          bg-white/[0.03]
                          px-2
                          py-0.5
                          text-[10px]
                          text-white/35
                        "
                      >
                        {adapter.status}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className="
                      mt-3
                      space-y-1.5
                      text-xs
                      text-white/35
                    "
                  >
                    <div>
                      Windows driver:{" "}
                      <span
                        className="
                          text-white/60
                        "
                      >
                        {adapter.driverVersion
                          ?? "Unknown"
                        }
                      </span>
                    </div>

                    <div>
                      Driver date:{" "}
                      <span
                        className="
                          text-white/60
                        "
                      >
                        {adapter.driverDate
                          ?? "Unknown"
                        }
                      </span>

                      {adapter.driverAgeDays
                        !== null
                        && adapter.driverAgeDays
                          !== undefined ? (
                        <span
                          className="
                            text-white/25
                          "
                        >
                          {" "}
                          ({adapter.driverAgeDays.toLocaleString()} days)
                        </span>
                      ) : null}
                    </div>

                    {adapter.nvidiaSmiVersion ? (
                      <div>
                        NVIDIA reported:{" "}
                        <span
                          className="
                            text-white/60
                          "
                        >
                          {adapter.nvidiaSmiVersion}
                        </span>
                      </div>
                    ) : null}

                    {adapter.pnpDeviceId ? (
                      <div
                        className="
                          break-all
                          text-[10px]
                          text-white/20
                        "
                      >
                        {adapter.pnpDeviceId}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            )}
          </div>


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


          <details
            className="
              border-b
              border-white/[0.06]
              px-4
              py-3
            "
          >
            <summary
              className="
                cursor-pointer
                text-xs
                font-semibold
                text-white/40
              "
            >
              Display-driver package details
              {" "}
              ({report.displayDriverPackages.length})
            </summary>

            <div
              className="
                mt-3
                space-y-1
                font-mono
                text-[10px]
                leading-relaxed
                text-white/25
              "
            >
              {report.displayDriverPackages.length > 0 ? (
                report.displayDriverPackages.map(
                  (
                    entry,
                    index
                  ) => (
                    <div
                      key={
                        `${entry}-${index}`
                      }
                      className="
                        break-all
                      "
                    >
                      {entry}
                    </div>
                  )
                )
              ) : (
                <div>
                  No display-driver package details were returned.
                </div>
              )}
            </div>
          </details>


          <div
            className="
              px-4
              py-3
              text-[10px]
              leading-relaxed
              text-white/22
            "
          >
            GameAtlas does not update, remove, or clean graphics drivers.
            Driver dates and retained packages are troubleshooting signals,
            not proof that a driver is faulty. Multi-GPU and mixed-vendor
            systems can legitimately contain more than one display driver.
          </div>
        </>
      ) : null}
    </div>
  );
}
