import SteamLaunchOptionsPanel from "./SteamLaunchOptionsPanel";
import {
  CheckCircle2,
  Copy,
  Gauge,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  buildLinuxLaunchOptions,
  getLinuxPerformanceCapabilities,
  getLinuxPerformanceSettings,
  resetLinuxPerformanceSettings,
  saveLinuxPerformanceSettings,
} from "../services/linuxPerformance";

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
        {available
          ? tool?.version
            || "Installed"
          : "Not detected"}
      </div>
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
      className="
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


      {error ? (
        <div
          className="
            rounded-xl
            border
            border-red-500/20
            bg-red-500/[0.06]
            p-3
            text-xs
            text-red-200/70
          "
        >
          {error}
        </div>
      ) : null}


      {message ? (
        <div
          className="
            rounded-xl
            border
            border-emerald-500/15
            bg-emerald-500/[0.05]
            p-3
            text-xs
            text-emerald-100/60
          "
        >
          {message}
        </div>
      ) : null}


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
        />

        <ToolStatus
          label="GameMode"
          tool={
            capabilities?.gameMode
          }
        />

        <ToolStatus
          label="Gamescope"
          tool={
            capabilities?.gamescope
          }
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
