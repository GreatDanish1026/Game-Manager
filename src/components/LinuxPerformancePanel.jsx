import SteamLaunchOptionsPanel from "./SteamLaunchOptionsPanel";
import LinuxDependencyNotice, {
  LINUX_DEPENDENCIES,
} from "./LinuxDependencyNotice";
import LinuxActionStatus from "./LinuxActionStatus";
import {
  Activity,
  CheckCircle2,
  Copy,
  Gauge,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  buildLinuxLaunchOptions,
  defaultLinuxPerformanceSettings,
  getLinuxPerformanceCapabilities,
  getLinuxPerformanceSettings,
  resetLinuxPerformanceSettings,
  saveLinuxPerformanceSettings,
} from "../services/linuxPerformance";


const PERFORMANCE_PRESETS = [
  {
    id: "compatibility",
    icon: ShieldCheck,
    name: "Compatibility first",
    description: "No wrappers or experimental environment flags. Best when diagnosing a launch problem.",
  },
  {
    id: "balanced",
    icon: Gauge,
    name: "Balanced",
    description: "Use GameMode for the game session without changing display, HDR, or runtime behavior.",
  },
  {
    id: "smooth-60",
    icon: TimerReset,
    name: "Smooth 60 FPS",
    description: "Apply a 60 FPS limit with an installed limiter. HDR, scaling, and Wine-Wayland stay off.",
  },
  {
    id: "monitor",
    icon: Activity,
    name: "Performance monitor",
    description: "Show MangoHud's compact FPS view and use GameMode when available.",
  },
];


function settingsForPreset(
  id,
  capabilities
) {
  const defaults =
    defaultLinuxPerformanceSettings();
  const mangoHud =
    Boolean(capabilities?.mangoHud?.available);
  const gameMode =
    Boolean(capabilities?.gameMode?.available);
  const gamescope =
    Boolean(capabilities?.gamescope?.available);

  if (id === "balanced") {
    return gameMode
      ? {
          ...defaults,
          gameModeEnabled: true,
        }
      : null;
  }

  if (id === "smooth-60") {
    if (gamescope) {
      return {
        ...defaults,
        gameModeEnabled: gameMode,
        gamescopeEnabled: true,
        fpsLimit: 60,
      };
    }

    if (mangoHud) {
      return {
        ...defaults,
        gameModeEnabled: gameMode,
        mangoHudEnabled: true,
        mangoHudFpsOnly: true,
        fpsLimit: 60,
        fpsLimitMethod: "early",
      };
    }

    return null;
  }

  if (id === "monitor") {
    return mangoHud
      ? {
          ...defaults,
          gameModeEnabled: gameMode,
          mangoHudEnabled: true,
          mangoHudFpsOnly: true,
        }
      : null;
  }

  return defaults;
}


function settingsMatch(
  left,
  right
) {
  return Object.keys(
    defaultLinuxPerformanceSettings()
  ).every(
    (key) => left[key] === right[key]
  );
}

function normalizedStore(
  game
) {
  return String(
    game?.store
    ?? ""
  )
    .trim()
    .toLowerCase();
}


function launchOptionGuidance(
  game
) {
  const store =
    normalizedStore(
      game
    );

  if (store === "steam") {
    return "Save directly to Steam below or copy into Steam → Properties → General → Launch Options.";
  }

  if (
    store.includes("heroic")
    || store === "epic"
    || store === "gog"
  ) {
    return "Copy these options into the game's advanced launch options in Heroic.";
  }

  if (store === "lutris") {
    return "Use these values when configuring the game's command prefix / environment options in Lutris.";
  }

  return "Copy these generated options into the launcher or runtime configuration used for this game.";
}



function ToolStatus({
  label,
  tool,
  dependency,
  detecting = false,
  onRefresh,
}) {
  const available =
    Boolean(
      tool?.available
    );

  return (
    <div
      className="
        rounded-xl
        border
        border-white/[0.08]
        bg-black/10
        p-3
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        {available ? (
          <CheckCircle2
            className="
              h-4
              w-4
              text-emerald-400
            "
          />
        ) : detecting ? (
          <RefreshCw
            className="h-4 w-4 animate-spin text-white/30"
          />
        ) : (
          <TriangleAlert
            className="
              h-4
              w-4
              text-amber-300
            "
          />
        )}

        <div
          className="
            text-sm
            font-semibold
            text-white/75
          "
        >
          {label}
        </div>
      </div>

      <div
        className="
          mt-1.5
          truncate
          text-xs
          text-white/35
        "
        title={
          tool?.path
          ?? tool?.version
          ?? ""
        }
      >
        {detecting
          ? "Checking…"
          : available
          ? tool?.version
            || "Installed"
          : "Not detected"}
      </div>

      {!available
      && !detecting ? (
        <div className="mt-2.5">
          <LinuxDependencyNotice
            dependency={dependency}
            onRefresh={onRefresh}
            refreshing={detecting}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}


function ToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={
        () => {
          if (!disabled) {
            onChange(
              !checked
            );
          }
        }
      }
      disabled={
        disabled
      }
      className={`
        flex
        w-full
        items-center
        justify-between
        gap-4
        rounded-xl
        border
        p-3.5
        text-left
        transition
        ${
          checked
            ? "border-cyan-400/20 bg-cyan-500/[0.07]"
            : "border-white/[0.08] bg-black/10"
        }
        ${
          disabled
            ? "cursor-not-allowed opacity-40"
            : "hover:bg-white/[0.045]"
        }
      `}
    >
      <div>
        <div
          className="
            text-sm
            font-semibold
            text-white/75
          "
        >
          {title}
        </div>

        <div
          className="
            mt-1
            text-xs
            leading-relaxed
            text-white/35
          "
        >
          {description}
        </div>
      </div>

      <div
        className={`
          relative
          h-6
          w-11
          shrink-0
          rounded-full
          transition
          ${
            checked
              ? "bg-cyan-500/70"
              : "bg-white/10"
          }
        `}
      >
        <div
          className={`
            absolute
            top-1
            h-4
            w-4
            rounded-full
            bg-white
            transition
            ${
              checked
                ? "left-6"
                : "left-1"
            }
          `}
        />
      </div>
    </button>
  );
}


export default function LinuxPerformancePanel({
  game,
}) {
  const [
    capabilities,
    setCapabilities,
  ] =
    useState(null);

  const [
    settings,
    setSettings,
  ] =
    useState(
      () =>
        getLinuxPerformanceSettings(
          game
        )
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    message,
    setMessage,
  ] =
    useState(null);

  const [
    error,
    setError,
  ] =
    useState(null);


  useEffect(
    () => {
      setSettings(
        getLinuxPerformanceSettings(
          game
        )
      );

      setMessage(
        null
      );

      setError(
        null
      );
    },
    [
      game?.id,
      game?.store,
      game?.launcherId,
    ]
  );


  async function refreshCapabilities() {
    setLoading(
      true
    );

    setError(
      null
    );

    try {
      const result =
        await getLinuxPerformanceCapabilities();

      setCapabilities(
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
      refreshCapabilities();
    },
    []
  );


  const preview =
    useMemo(
      () =>
        buildLinuxLaunchOptions(
          settings
        ),
      [
        settings,
      ]
    );

  const activePreset =
    useMemo(
      () =>
        PERFORMANCE_PRESETS.find(
          (preset) => {
            const presetSettings =
              settingsForPreset(
                preset.id,
                capabilities
              );

            return presetSettings
              && settingsMatch(
                settings,
                presetSettings
              );
          }
        )?.id
        ?? null,
      [
        capabilities,
        settings,
      ]
    );


  if (
    !loading
    && capabilities
    && !capabilities.supported
  ) {
    return null;
  }


  function update(
    patch
  ) {
    const saved =
      saveLinuxPerformanceSettings(
        game,
        {
          ...settings,
          ...patch,
        }
      );

    setSettings(
      saved
    );

    setMessage(
      "Performance settings saved."
    );
  }


  async function copyLaunchOptions() {
    try {
      await navigator.clipboard.writeText(
        preview.launchOptions
      );

      setMessage(
        "Launch options copied."
      );
    } catch (copyError) {
      setError(
        `Could not copy launch options: ${String(
          copyError
        )}`
      );
    }
  }


  function reset() {
    setSettings(
      resetLinuxPerformanceSettings(
        game
      )
    );

    setMessage(
      "Linux performance settings reset."
    );

    setError(
      null
    );
  }


  function applyPreset(
    preset
  ) {
    const next =
      settingsForPreset(
        preset.id,
        capabilities
      );

    if (!next) {
      setError(
        `The tools required for ${preset.name} were not detected.`
      );
      return;
    }

    const saved =
      saveLinuxPerformanceSettings(
        game,
        next
      );

    setSettings(saved);
    setError(null);
    setMessage(
      `${preset.name} preset applied. Review the generated launch options before saving them to your launcher.`
    );
  }


  const mangoAvailable =
    Boolean(
      capabilities
        ?.mangoHud
        ?.available
    );

  const gameModeAvailable =
    Boolean(
      capabilities
        ?.gameMode
        ?.available
    );

  const gamescopeAvailable =
    Boolean(
      capabilities
        ?.gamescope
        ?.available
    );


  return (
    <div
      id="linux-performance-controls"
      aria-busy={loading}
      className="
        scroll-mt-20
        space-y-5
      "
    >
      <div
        className="
          flex
          flex-col
          gap-3
          rounded-xl
          border
          border-cyan-400/10
          bg-cyan-500/[0.035]
          p-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <div
          className="
            flex
            items-start
            gap-3
          "
        >
          <Gauge
            className="
              mt-0.5
              h-5
              w-5
              shrink-0
              text-cyan-300
            "
          />

          <div>
            <div
              className="
                text-sm
                font-semibold
                text-white/80
              "
            >
              Linux Performance Controls
            </div>

            <div
              className="
                mt-1
                max-w-3xl
                text-xs
                leading-relaxed
                text-white/40
              "
            >
              Configure per-game MangoHud, frame limiting,
              GameMode, Gamescope, HDR, and Wayland launch options.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={
            refreshCapabilities
          }
          disabled={
            loading
          }
          className="
            inline-flex
            items-center
            justify-center
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

          Detect Tools
        </button>
      </div>


      <LinuxActionStatus
        type="error"
        message={error}
      />

      <LinuxActionStatus
        type="success"
        message={message}
      />


      <section
        aria-labelledby="linux-performance-presets"
        className="rounded-xl border border-white/[0.08] bg-black/10 p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div
              id="linux-performance-presets"
              className="text-sm font-semibold text-white/75"
            >
              Safe starting points
            </div>
            <div className="mt-1 max-w-3xl text-xs leading-relaxed text-white/35">
              Presets replace the GameAtlas settings below, never existing launcher options. Experimental HDR, scaling, resolution, and Wine-Wayland settings remain off.
            </div>
          </div>

          <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-[10px] font-semibold text-white/40">
            {activePreset
              ? PERFORMANCE_PRESETS.find((preset) => preset.id === activePreset)?.name
              : "Custom settings"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {PERFORMANCE_PRESETS.map((preset) => {
            const PresetIcon = preset.icon;
            const available = Boolean(
              settingsForPreset(
                preset.id,
                capabilities
              )
            );
            const selected =
              activePreset === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                disabled={loading || !available}
                onClick={() => applyPreset(preset)}
                className={`rounded-xl border p-3 text-left transition ${
                  selected
                    ? "border-cyan-400/25 bg-cyan-500/[0.08]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.045]"
                } disabled:cursor-not-allowed disabled:opacity-35`}
              >
                <div className="flex items-center gap-2">
                  <PresetIcon className={`h-4 w-4 ${selected ? "text-cyan-300" : "text-white/35"}`} />
                  <span className="text-xs font-semibold text-white/75">
                    {preset.name}
                  </span>
                  {selected ? (
                    <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-300" />
                  ) : null}
                </div>

                <div className="mt-2 text-[11px] leading-relaxed text-white/35">
                  {preset.description}
                </div>

                {!loading && !available ? (
                  <div className="mt-2 text-[10px] font-medium text-amber-200/60">
                    Required tool not detected
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>


      <div
        className="
          grid
          grid-cols-1
          gap-3
          md:grid-cols-3
        "
      >
        <ToolStatus
          label="MangoHud"
          tool={
            capabilities?.mangoHud
          }
          dependency={LINUX_DEPENDENCIES.mangohud}
          detecting={loading}
          onRefresh={refreshCapabilities}
        />

        <ToolStatus
          label="GameMode"
          tool={
            capabilities?.gameMode
          }
          dependency={LINUX_DEPENDENCIES.gamemode}
          detecting={loading}
          onRefresh={refreshCapabilities}
        />

        <ToolStatus
          label="Gamescope"
          tool={
            capabilities?.gamescope
          }
          dependency={LINUX_DEPENDENCIES.gamescope}
          detecting={loading}
          onRefresh={refreshCapabilities}
        />
      </div>


      <div
        className="
          grid
          grid-cols-1
          gap-3
          xl:grid-cols-2
        "
      >
        <ToggleRow
          title="MangoHud"
          description="Enable the MangoHud overlay for this game."
          checked={
            settings.mangoHudEnabled
          }
          disabled={
            !mangoAvailable
          }
          onChange={
            (checked) =>
              update({
                mangoHudEnabled:
                  checked,
              })
          }
        />

        <ToggleRow
          title="GameMode"
          description="Launch through gamemoderun when GameMode is installed."
          checked={
            settings.gameModeEnabled
          }
          disabled={
            !gameModeAvailable
          }
          onChange={
            (checked) =>
              update({
                gameModeEnabled:
                  checked,
              })
          }
        />

        <ToggleRow
          title="Gamescope"
          description="Wrap the game in Gamescope for frame limiting, scaling, fullscreen, and HDR."
          checked={
            settings.gamescopeEnabled
          }
          disabled={
            !gamescopeAvailable
          }
          onChange={
            (checked) =>
              update({
                gamescopeEnabled:
                  checked,
              })
          }
        />

        <ToggleRow
          title="HDR"
          description="Expose HDR to compatible Proton/DXVK games. Gamescope also receives --hdr-enabled when active."
          checked={
            settings.hdrEnabled
          }
          onChange={
            (checked) =>
              update({
                hdrEnabled:
                  checked,
              })
          }
        />

        <ToggleRow
          title="Wayland"
          description="Request the Proton Wine-Wayland driver. Requires a Proton build that includes Wine-Wayland support."
          checked={
            settings.waylandEnabled
          }
          onChange={
            (checked) =>
              update({
                waylandEnabled:
                  checked,
              })
          }
        />

        <ToggleRow
          title="MangoHud FPS-only View"
          description="Use MangoHud's compact FPS-only display."
          checked={
            settings.mangoHudFpsOnly
          }
          disabled={
            !settings.mangoHudEnabled
            || !mangoAvailable
          }
          onChange={
            (checked) =>
              update({
                mangoHudFpsOnly:
                  checked,
              })
          }
        />
      </div>


      {(settings.hdrEnabled || settings.waylandEnabled) ? (
        <div
          className="
            rounded-xl
            border
            border-amber-500/15
            bg-amber-500/[0.04]
            p-3
            text-xs
            leading-relaxed
            text-amber-100/55
          "
        >
          HDR and Wine-Wayland support depend on the compositor,
          display, graphics driver, and Proton/Wine build. Keep these
          toggles off for games that do not need them.
        </div>
      ) : null}


      <div
        className="
          grid
          grid-cols-1
          gap-4
          rounded-xl
          border
          border-white/[0.08]
          bg-black/10
          p-4
          lg:grid-cols-3
        "
      >
        <label>
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
            FPS Limit
          </div>

          <input
            type="number"
            min="0"
            max="1000"
            value={
              settings.fpsLimit
            }
            onChange={
              (event) =>
                update({
                  fpsLimit:
                    event.target.value,
                })
            }
            className="
              w-full
              rounded-lg
              border
              border-white/[0.08]
              bg-[#101722]
              [color-scheme:dark]
              px-3
              py-2.5
              text-sm
              text-white/75
              outline-none
              focus:border-cyan-400/30
            "
          />

          <div
            className="
              mt-1
              text-[10px]
              text-white/25
            "
          >
            0 = unlimited.
          </div>
        </label>


        <label>
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
            MangoHud Limit Method
          </div>

          <select
            value={
              settings.fpsLimitMethod
            }
            disabled={
              settings.gamescopeEnabled
            }
            onChange={
              (event) =>
                update({
                  fpsLimitMethod:
                    event.target.value,
                })
            }
            className="
              w-full
              rounded-lg
              border
              border-white/[0.08]
              bg-[#101722]
              [color-scheme:dark]
              px-3
              py-2.5
              text-sm
              text-white/75
              outline-none
              disabled:opacity-40
              focus:border-cyan-400/30
            "
          >
            <option value="late">
              Late — lower latency
            </option>

            <option value="early">
              Early — smoother frametimes
            </option>
          </select>
        </label>


        <label>
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
            Gamescope Scaling
          </div>

          <select
            value={
              settings.scalingMode
            }
            disabled={
              !settings.gamescopeEnabled
            }
            onChange={
              (event) =>
                update({
                  scalingMode:
                    event.target.value,
                })
            }
            className="
              w-full
              rounded-lg
              border
              border-white/[0.08]
              bg-[#101722]
              px-3
              py-2.5
              text-sm
              text-white/75
              outline-none
              disabled:opacity-40
              focus:border-cyan-400/30
            "
          >
            <option value="none">
              None
            </option>

            <option value="fsr">
              FSR
            </option>

            <option value="nis">
              NIS
            </option>

            <option value="integer">
              Integer
            </option>

            <option value="stretch">
              Stretch
            </option>
          </select>
        </label>
      </div>


      {settings.gamescopeEnabled ? (
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
              mb-3
              text-xs
              font-semibold
              text-white/60
            "
          >
            Gamescope Resolution
          </div>

          <div
            className="
              grid
              grid-cols-2
              gap-3
              lg:grid-cols-4
            "
          >
            {[
              [
                "Game Width",
                "inputWidth",
              ],
              [
                "Game Height",
                "inputHeight",
              ],
              [
                "Output Width",
                "outputWidth",
              ],
              [
                "Output Height",
                "outputHeight",
              ],
            ].map(
              ([
                label,
                key,
              ]) => (
                <label
                  key={
                    key
                  }
                >
                  <div
                    className="
                      mb-1.5
                      text-[10px]
                      uppercase
                      tracking-wide
                      text-white/25
                    "
                  >
                    {label}
                  </div>

                  <input
                    type="number"
                    min="0"
                    value={
                      settings[key]
                    }
                    onChange={
                      (event) =>
                        update({
                          [key]:
                            event.target
                              .value,
                        })
                    }
                    placeholder="Auto"
                    className="
                      w-full
                      rounded-lg
                      border
                      border-white/[0.08]
                      bg-[#101722]
                      px-3
                      py-2
                      text-sm
                      text-white/70
                      outline-none
                    "
                  />
                </label>
              )
            )}
          </div>


          <div
            className="
              mt-3
            "
          >
            <ToggleRow
              title="Fullscreen Gamescope"
              description="Add -f to the generated Gamescope command."
              checked={
                settings.gamescopeFullscreen
              }
              onChange={
                (checked) =>
                  update({
                    gamescopeFullscreen:
                      checked,
                  })
              }
            />
          </div>
        </div>
      ) : null}


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
            sm:items-center
            sm:justify-between
          "
        >
          <div>
            <div
              className="
                text-xs
                font-semibold
                text-white/65
              "
            >
              Generated Launch Options
            </div>

            <div
              className="
                mt-1
                text-[10px]
                text-white/25
              "
            >
              {launchOptionGuidance(
                game
              )}
            </div>
          </div>

          <div
            className="
              flex
              gap-2
            "
          >
            <button
              type="button"
              onClick={
                reset
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-white/[0.08]
                bg-white/[0.025]
                px-3
                py-2
                text-xs
                font-semibold
                text-white/45
                hover:bg-white/[0.055]
              "
            >
              <RotateCcw
                className="h-3.5 w-3.5"
              />

              Reset
            </button>

            <button
              type="button"
              onClick={
                copyLaunchOptions
              }
              className="
                inline-flex
                items-center
                gap-1.5
                rounded-lg
                border
                border-cyan-400/20
                bg-cyan-500/10
                px-3
                py-2
                text-xs
                font-semibold
                text-cyan-100/75
                hover:bg-cyan-500/15
              "
            >
              <Copy
                className="h-3.5 w-3.5"
              />

              Copy
            </button>
          </div>
        </div>

        <div
          className="
            mt-3
            overflow-x-auto
            rounded-lg
            border
            border-white/[0.06]
            bg-[#0b1018]
            p-3
            font-mono
            text-xs
            leading-relaxed
            text-cyan-100/70
          "
        >
          {preview.launchOptions}
        </div>

        <SteamLaunchOptionsPanel game={game} launchOptions={preview.launchOptions} />

        {preview.notes.length
          > 0 ? (
          <div
            className="
              mt-3
              space-y-1
              text-xs
              text-amber-200/55
            "
          >
            {preview.notes.map(
              (
                note
              ) => (
                <div
                  key={
                    note
                  }
                >
                  {note}
                </div>
              )
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
