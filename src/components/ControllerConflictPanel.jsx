import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Gamepad2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getControllerConflictReport,
} from "../services/controllerConflicts";


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


function SoftwareBadge({
  item,
}) {
  const active =
    Boolean(
      item?.running
    );

  const detected =
    Boolean(
      item?.detected
    );

  return (
    <div
      className={`
        rounded-lg
        border
        px-3
        py-2.5
        ${
          active
            ? "border-amber-400/20 bg-amber-400/[0.05]"
            : detected
              ? "border-cyan-400/15 bg-cyan-400/[0.035]"
              : "border-white/[0.07] bg-black/10"
        }
      `}
      title={
        item?.evidence
        ?? ""
      }
    >
      <div
        className="
          text-xs
          font-semibold
          text-white/70
        "
      >
        {item?.name}
      </div>

      <div
        className={`
          mt-1
          text-[10px]
          ${
            active
              ? "text-amber-200/65"
              : detected
                ? "text-cyan-200/55"
                : "text-white/25"
          }
        `}
      >
        {active
          ? "Running"
          : detected
            ? "Installed / detected"
            : "Not detected"
        }
      </div>
    </div>
  );
}


export default function ControllerConflictPanel() {
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
      const result =
        await getControllerConflictReport();

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


  useEffect(
    () => {
      refresh();
    },
    []
  );


  const warnings =
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


  const connectedControllers =
    useMemo(
      () =>
        report?.devices
          ?.filter(
            (device) =>
              device.connected
          )
        ?? [],
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
        mt-6
        overflow-hidden
        rounded-xl
        border
        border-white/10
        bg-white/[0.025]
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          border-b
          border-white/[0.07]
          p-5
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
                text-base
                font-semibold
                text-white
              "
            >
              Controller Conflict Check
            </div>

            <div
              className="
                mt-1
                text-sm
                text-white/40
              "
            >
              Read-only Windows check for controller remappers,
              virtual devices, and common double-input patterns.
            </div>

            {report ? (
              <div
                className={`
                  mt-2
                  text-xs
                  ${
                    warnings > 0
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

          Rescan
        </button>
      </div>


      {error ? (
        <div
          className="
            border-b
            border-red-500/10
            bg-red-500/[0.04]
            px-5
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
            p-5
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

          Inspecting the Windows controller environment…
        </div>
      ) : null}


      {report ? (
        <>
          <div
            className="
              border-b
              border-white/[0.07]
              p-4
            "
          >
            <div
              className="
                mb-3
                flex
                items-center
                gap-2
                text-xs
                font-semibold
                uppercase
                tracking-wide
                text-white/30
              "
            >
              <Gamepad2
                className="h-3.5 w-3.5"
              />

              Connected Controllers
            </div>

            {connectedControllers.length > 0 ? (
              <div
                className="
                  grid
                  grid-cols-1
                  gap-2
                  md:grid-cols-2
                "
              >
                {connectedControllers.map(
                  (device) => (
                    <div
                      key={
                        `${device.displayName}-${device.instanceId ?? ""}`
                      }
                      className="
                        rounded-lg
                        border
                        border-emerald-400/12
                        bg-emerald-400/[0.035]
                        px-3
                        py-3
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
                            min-w-0
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              gap-2
                              text-sm
                              font-semibold
                              text-white/72
                            "
                          >
                            <CheckCircle2
                              className="
                                h-4
                                w-4
                                shrink-0
                                text-emerald-300/80
                              "
                            />

                            {device.displayName}
                          </div>

                          <div
                            className="
                              mt-1
                              text-xs
                              text-white/32
                            "
                          >
                            {device.virtualDevice
                              ? "Virtual controller"
                              : "Physical controller"
                            }
                            {device.connection
                              ? ` • ${device.connection}`
                              : ""
                            }
                          </div>

                          {device.name !== device.displayName ? (
                            <div
                              className="
                                mt-1
                                break-all
                                text-[10px]
                                text-white/20
                              "
                            >
                              Windows device: {device.name}
                            </div>
                          ) : null}
                        </div>

                        <span
                          className="
                            shrink-0
                            rounded-full
                            border
                            border-emerald-400/15
                            bg-emerald-400/[0.05]
                            px-2
                            py-0.5
                            text-[10px]
                            text-emerald-200/60
                          "
                        >
                          Connected
                        </span>
                      </div>
                    </div>
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
                No connected game controllers were detected by Windows.
              </div>
            )}
          </div>


          <div
            className="
              grid
              grid-cols-2
              gap-2
              border-b
              border-white/[0.07]
              p-4
              md:grid-cols-5
            "
          >
            {report.software
              .map(
                (item) => (
                  <SoftwareBadge
                    key={
                      item.name
                    }
                    item={
                      item
                    }
                  />
                )
              )}
          </div>


          <div
            className="
              border-b
              border-white/[0.07]
              p-4
            "
          >
            <div
              className="
                mb-3
                flex
                items-center
                gap-2
                text-xs
                font-semibold
                uppercase
                tracking-wide
                text-white/30
              "
            >
              <Gamepad2
                className="h-3.5 w-3.5"
              />

              Controller Devices / Virtual Devices
            </div>

            {report.devices
              .length > 0 ? (
              <div
                className="
                  space-y-2
                "
              >
                {report.devices
                  .map(
                    (
                      device
                    ) => (
                      <div
                        key={
                          `${device.name}-${device.instanceId ?? ""}`
                        }
                        className="
                          flex
                          flex-col
                          gap-1
                          rounded-lg
                          border
                          border-white/[0.06]
                          bg-black/10
                          px-3
                          py-2.5
                          sm:flex-row
                          sm:items-center
                          sm:justify-between
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
                              font-medium
                              text-white/65
                            "
                          >
                            {device.name}
                          </div>

                          <div
                            className="
                              mt-0.5
                              break-all
                              text-[10px]
                              text-white/22
                            "
                          >
                            {device.instanceId
                              ?? "Instance ID unavailable"
                            }
                          </div>
                        </div>

                        <div
                          className="
                            flex
                            flex-wrap
                            gap-1.5
                          "
                        >
                          {device.virtualDevice ? (
                            <span
                              className="
                                rounded-full
                                border
                                border-cyan-400/15
                                bg-cyan-400/[0.05]
                                px-2
                                py-0.5
                                text-[10px]
                                text-cyan-200/60
                              "
                            >
                              Virtual
                            </span>
                          ) : (
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
                              Physical / system
                            </span>
                          )}

                          {device.status ? (
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
                              {device.status}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                  )}
              </div>
            ) : (
              <div
                className="
                  text-xs
                  text-white/30
                "
              >
                No matching controller devices were returned by Windows.
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
              {report.findings
                .map(
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
            Detection is intentionally conservative. A running tool or
            virtual controller is not automatically a problem. GameAtlas
            reports combinations that commonly contribute to duplicate,
            remapped, or unexpected controller input.
          </div>
        </>
      ) : null}
    </div>
  );
}
