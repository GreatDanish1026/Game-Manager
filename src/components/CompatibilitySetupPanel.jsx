import {
  BadgeCheck,
  CheckCircle2,
  Cpu,
  Gauge,
  MonitorCog,
  Save,
  Sparkles,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  emptyKnownGoodSetup,
  getKnownGoodSetup,
  getSystemCompatibilityEstimate,
  markKnownGoodVerified,
  saveKnownGoodSetup,
} from "../services/compatibilitySetup";


const TOGGLE_OPTIONS = [
  {
    value:
      null,

    label:
      "Not specified",
  },
  {
    value:
      true,

    label:
      "On",
  },
  {
    value:
      false,

    label:
      "Off",
  },
];


function formatDate(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toLocaleString(
    undefined,
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit",
    }
  );
}


function ToggleField({
  label,
  value,
  onChange,
}) {
  return (
    <label
      className="
        block
      "
    >
      <div
        className="
          mb-1.5
          text-[10px]
          font-semibold
          uppercase
          tracking-wide
          text-white/30
        "
      >
        {label}
      </div>

      <select
        value={
          value === true
            ? "true"
            : value === false
              ? "false"
              : ""
        }
        onChange={
          (
            event
          ) => {
            const raw =
              event.target.value;

            onChange(
              raw === "true"
                ? true
                : raw === "false"
                  ? false
                  : null
            );
          }
        }
        className="
          w-full
          rounded-lg
          border
          border-white/[0.08]
          bg-black/20
          px-3
          py-2
          text-sm
          text-white/70
          outline-none
          focus:border-cyan-400/25
        "
      >
        {TOGGLE_OPTIONS.map(
          (
            option
          ) => (
            <option
              key={
                String(
                  option.value
                )
              }
              value={
                option.value === true
                  ? "true"
                  : option.value === false
                    ? "false"
                    : ""
              }
            >
              {option.label}
            </option>
          )
        )}
      </select>
    </label>
  );
}


function TextField({
  label,
  value,
  placeholder,
  onChange,
}) {
  return (
    <label
      className="
        block
      "
    >
      <div
        className="
          mb-1.5
          text-[10px]
          font-semibold
          uppercase
          tracking-wide
          text-white/30
        "
      >
        {label}
      </div>

      <input
        type="text"
        value={
          value
        }
        placeholder={
          placeholder
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event.target.value
            )
        }
        className="
          w-full
          rounded-lg
          border
          border-white/[0.08]
          bg-black/20
          px-3
          py-2
          text-sm
          text-white/70
          outline-none
          placeholder:text-white/20
          focus:border-cyan-400/25
        "
      />
    </label>
  );
}


function estimateClasses(
  tone
) {
  switch (
    tone
  ) {
    case "excellent":
      return {
        border:
          "border-emerald-400/20",

        background:
          "bg-emerald-400/[0.05]",

        text:
          "text-emerald-200",
      };

    case "good":
      return {
        border:
          "border-cyan-400/20",

        background:
          "bg-cyan-400/[0.05]",

        text:
          "text-cyan-200",
      };

    case "compatible":
      return {
        border:
          "border-amber-400/20",

        background:
          "bg-amber-400/[0.05]",

        text:
          "text-amber-200",
      };

    default:
      return {
        border:
          "border-white/[0.08]",

        background:
          "bg-white/[0.02]",

        text:
          "text-white/65",
      };
  }
}


export default function CompatibilitySetupPanel({
  game,
}) {
  const [
    setup,
    setSetup,
  ] =
    useState(
      () =>
        getKnownGoodSetup(
          game
        )
    );

  const [
    estimate,
    setEstimate,
  ] =
    useState(null);

  const [
    analyzing,
    setAnalyzing,
  ] =
    useState(false);

  const [
    estimateError,
    setEstimateError,
  ] =
    useState(null);

  const [
    savedMessage,
    setSavedMessage,
  ] =
    useState(null);


  useEffect(
    () => {
      setSetup(
        getKnownGoodSetup(
          game
        )
      );

      setEstimate(
        null
      );

      setEstimateError(
        null
      );

      setSavedMessage(
        null
      );
    },
    [
      game?.id,
    ]
  );


  useEffect(
    () => {
      let cancelled =
        false;

      if (!game?.id) {
        return () => {
          cancelled = true;
        };
      }

      setAnalyzing(
        true
      );

      getSystemCompatibilityEstimate(
        game
      )
        .then(
          (
            result
          ) => {
            if (!cancelled) {
              setEstimate(
                result
              );
            }
          }
        )
        .catch(
          (
            error
          ) => {
            if (!cancelled) {
              setEstimateError(
                String(
                  error
                )
              );
            }
          }
        )
        .finally(
          () => {
            if (!cancelled) {
              setAnalyzing(
                false
              );
            }
          }
        );

      return () => {
        cancelled =
          true;
      };
    },
    [
      game?.id,
      game?.features,
      game?.technical,
    ]
  );


  function change(
    key,
    value
  ) {
    setSetup(
      (
        current
      ) => ({
        ...current,
        [key]:
          value,
      })
    );

    setSavedMessage(
      null
    );
  }


  function handleSave() {
    saveKnownGoodSetup(
      game,
      setup
    );

    setSavedMessage(
      "Known-good setup saved."
    );
  }


  function handleVerified() {
    const next =
      markKnownGoodVerified(
        game,
        setup
      );

    setSetup(
      next
    );

    setSavedMessage(
      "Marked as verified with the current game version when available."
    );
  }


  async function handleAnalyze() {
    setAnalyzing(
      true
    );

    setEstimateError(
      null
    );

    try {
      setEstimate(
        await getSystemCompatibilityEstimate(
          game
        )
      );
    } catch (
      error
    ) {
      setEstimateError(
        String(
          error
        )
      );
    } finally {
      setAnalyzing(
        false
      );
    }
  }


  const appearance =
    estimateClasses(
      estimate?.tone
    );


  return (
    <div
      className="
        grid
        grid-cols-1
        gap-4
        xl:grid-cols-2
      "
    >
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
            gap-3
            sm:flex-row
            sm:items-start
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                flex
                items-center
                gap-2
                text-sm
                font-semibold
                text-white/80
              "
            >
              <BadgeCheck
                className="
                  h-4
                  w-4
                  text-emerald-300
                "
              />

              Known-Good Setup
            </div>

            <div
              className="
                mt-1
                text-xs
                leading-relaxed
                text-white/30
              "
            >
              Record a configuration you have personally tested and know works well.
            </div>
          </div>

          {setup.verifiedAt ? (
            <div
              className="
                shrink-0
                rounded-full
                border
                border-emerald-400/20
                bg-emerald-400/[0.07]
                px-2.5
                py-1
                text-[10px]
                font-semibold
                text-emerald-200/75
              "
            >
              Verified{" "}
              {formatDate(
                setup.verifiedAt
              )}
            </div>
          ) : null}
        </div>


        <div
          className="
            mt-4
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-2
          "
        >
          <TextField
            label="Resolution"
            value={
              setup.resolution
            }
            placeholder="4K / 3840×2160"
            onChange={
              (
                value
              ) =>
                change(
                  "resolution",
                  value
                )
            }
          />

          <TextField
            label="Graphics Preset"
            value={
              setup.graphicsPreset
            }
            placeholder="Ultra / High / Custom"
            onChange={
              (
                value
              ) =>
                change(
                  "graphicsPreset",
                  value
                )
            }
          />

          <TextField
            label="Target / Observed FPS"
            value={
              setup.targetFps
            }
            placeholder="120 FPS / 90–110 FPS"
            onChange={
              (
                value
              ) =>
                change(
                  "targetFps",
                  value
                )
            }
          />

          <TextField
            label="Upscaling"
            value={
              setup.upscaling
            }
            placeholder="DLSS Quality / FSR Quality / Off"
            onChange={
              (
                value
              ) =>
                change(
                  "upscaling",
                  value
                )
            }
          />

          <ToggleField
            label="Frame Generation"
            value={
              setup.frameGeneration
            }
            onChange={
              (
                value
              ) =>
                change(
                  "frameGeneration",
                  value
                )
            }
          />

          <ToggleField
            label="Ray Tracing"
            value={
              setup.rayTracing
            }
            onChange={
              (
                value
              ) =>
                change(
                  "rayTracing",
                  value
                )
            }
          />

          <ToggleField
            label="HDR"
            value={
              setup.hdr
            }
            onChange={
              (
                value
              ) =>
                change(
                  "hdr",
                  value
                )
            }
          />

          <TextField
            label="Game Version"
            value={
              setup.gameVersion
            }
            placeholder="Filled automatically when verified if available"
            onChange={
              (
                value
              ) =>
                change(
                  "gameVersion",
                  value
                )
            }
          />

          <div
            className="
              sm:col-span-2
            "
          >
            <TextField
              label="GPU Driver Version"
              value={
                setup.driverVersion
              }
              placeholder="Optional"
              onChange={
                (
                  value
                ) =>
                  change(
                    "driverVersion",
                    value
                  )
              }
            />
          </div>

          <label
            className="
              block
              sm:col-span-2
            "
          >
            <div
              className="
                mb-1.5
                text-[10px]
                font-semibold
                uppercase
                tracking-wide
                text-white/30
              "
            >
              Notes
            </div>

            <textarea
              value={
                setup.notes
              }
              placeholder="Stable with RenoDX, cap FPS at 120, turn shadows down one step, etc."
              onChange={
                (
                  event
                ) =>
                  change(
                    "notes",
                    event.target.value
                  )
              }
              rows={
                4
              }
              className="
                w-full
                resize-y
                rounded-lg
                border
                border-white/[0.08]
                bg-black/20
                px-3
                py-2
                text-sm
                leading-relaxed
                text-white/70
                outline-none
                placeholder:text-white/20
                focus:border-cyan-400/25
              "
            />
          </label>
        </div>


        <div
          className="
            mt-4
            flex
            flex-wrap
            items-center
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              handleSave
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.035]
              px-3
              py-2
              text-xs
              font-semibold
              text-white/60
              hover:bg-white/[0.06]
              hover:text-white/80
            "
          >
            <Save
              className="
                h-3.5
                w-3.5
              "
            />

            Save Setup
          </button>

          <button
            type="button"
            onClick={
              handleVerified
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-emerald-400/20
              bg-emerald-400/[0.07]
              px-3
              py-2
              text-xs
              font-semibold
              text-emerald-200/75
              hover:bg-emerald-400/[0.11]
            "
          >
            <CheckCircle2
              className="
                h-3.5
                w-3.5
              "
            />

            Mark Verified
          </button>

          {savedMessage ? (
            <div
              className="
                text-xs
                text-emerald-200/55
              "
            >
              {savedMessage}
            </div>
          ) : null}
        </div>
      </div>


      <div
        className={`
          rounded-xl
          border
          p-4
          ${appearance.border}
          ${appearance.background}
        `}
      >
        <div
          className="
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-start
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                flex
                items-center
                gap-2
                text-sm
                font-semibold
                text-white/80
              "
            >
              <MonitorCog
                className="
                  h-4
                  w-4
                  text-cyan-300
                "
              />

              System Compatibility Estimate
            </div>

            <div
              className="
                mt-1
                text-xs
                leading-relaxed
                text-white/30
              "
            >
              A conservative capability-fit estimate based on detected hardware and known game features.
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleAnalyze
            }
            disabled={
              analyzing
            }
            className="
              inline-flex
              shrink-0
              items-center
              gap-2
              rounded-lg
              border
              border-white/[0.08]
              bg-white/[0.025]
              px-3
              py-2
              text-xs
              font-semibold
              text-white/50
              hover:bg-white/[0.05]
              hover:text-white/70
              disabled:opacity-40
            "
          >
            <Sparkles
              className="
                h-3.5
                w-3.5
              "
            />

            {analyzing
              ? "Analyzing…"
              : "Analyze"
            }
          </button>
        </div>


        {estimateError ? (
          <div
            className="
              mt-4
              rounded-lg
              border
              border-amber-400/15
              bg-amber-400/[0.05]
              px-3
              py-2
              text-xs
              text-amber-200/60
            "
          >
            {estimateError}
          </div>
        ) : null}


        {estimate ? (
          <>
            <div
              className="
                mt-5
                flex
                flex-wrap
                items-baseline
                gap-3
              "
            >
              <div
                className={`
                  text-2xl
                  font-bold
                  ${appearance.text}
                `}
              >
                {estimate.tier}
              </div>

              <div
                className="
                  text-xs
                  text-white/25
                "
              >
                capability fit
              </div>
            </div>


            <div
              className="
                mt-4
                grid
                grid-cols-1
                gap-2
                sm:grid-cols-3
              "
            >
              <div
                className="
                  rounded-lg
                  border
                  border-white/[0.06]
                  bg-black/10
                  p-3
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  <Gauge
                    className="
                      h-3
                      w-3
                    "
                  />
                  GPU
                </div>

                <div
                  className="
                    mt-1.5
                    text-xs
                    font-medium
                    text-white/60
                  "
                >
                  {estimate.hardware.gpuName
                    ?? "Unknown"
                  }
                </div>
              </div>

              <div
                className="
                  rounded-lg
                  border
                  border-white/[0.06]
                  bg-black/10
                  p-3
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-1.5
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  <Cpu
                    className="
                      h-3
                      w-3
                    "
                  />
                  CPU
                </div>

                <div
                  className="
                    mt-1.5
                    text-xs
                    font-medium
                    text-white/60
                  "
                >
                  {estimate.hardware.cpuName
                    ?? "Unknown"
                  }
                </div>
              </div>

              <div
                className="
                  rounded-lg
                  border
                  border-white/[0.06]
                  bg-black/10
                  p-3
                "
              >
                <div
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                "
                >
                  Memory
                </div>

                <div
                  className="
                    mt-1.5
                    text-xs
                    font-medium
                    text-white/60
                  "
                >
                  {estimate.hardware.ramGb
                    ? `${Math.round(
                        estimate.hardware.ramGb
                      )} GB RAM`
                    : "Unknown"
                  }

                  {estimate.hardware.vramGb
                    ? ` • ${Math.round(
                        estimate.hardware.vramGb
                      )} GB VRAM`
                    : ""
                  }
                </div>
              </div>
            </div>


            {estimate.positives.length > 0 ? (
              <div
                className="
                  mt-4
                "
              >
                <div
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  Positive Signals
                </div>

                <div
                  className="
                    mt-2
                    space-y-1.5
                  "
                >
                  {estimate.positives.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="
                          flex
                          items-start
                          gap-2
                          text-xs
                          leading-relaxed
                          text-white/45
                        "
                      >
                        <CheckCircle2
                          className="
                            mt-0.5
                            h-3.5
                            w-3.5
                            shrink-0
                            text-emerald-300/60
                          "
                        />

                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}


            {estimate.cautions.length > 0 ? (
              <div
                className="
                  mt-4
                "
              >
                <div
                  className="
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-white/25
                  "
                >
                  Cautions
                </div>

                <div
                  className="
                    mt-2
                    space-y-1.5
                  "
                >
                  {estimate.cautions.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="
                          text-xs
                          leading-relaxed
                          text-amber-200/55
                        "
                      >
                        {item}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}


            <div
              className="
                mt-5
                rounded-lg
                border
                border-white/[0.05]
                bg-black/10
                px-3
                py-2.5
                text-[10px]
                leading-relaxed
                text-white/25
              "
            >
              {estimate.disclaimer}
            </div>
          </>
        ) : (
          <div
            className="
              mt-5
              rounded-lg
              border
              border-dashed
              border-white/[0.08]
              px-4
              py-6
              text-center
              text-xs
              text-white/25
            "
          >
            {analyzing
              ? "Analyzing detected hardware and game capabilities…"
              : "No estimate available yet."
            }
          </div>
        )}
      </div>
    </div>
  );
}
