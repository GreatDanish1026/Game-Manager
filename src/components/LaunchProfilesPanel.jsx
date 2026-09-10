import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Gauge,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Wrench,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  clearLocalInstallationCache,
  inspectLocalInstallation,
} from "../services/localInstallation";

import {
  createLaunchProfile,
  getLaunchProfileState,
  launchConfiguredProfile,
  resetLaunchProfiles,
  saveLaunchProfileState,
} from "../services/launchProfiles";

import {
  error as logError,
} from "../services/logging";


function profileIcon(
  profile
) {
  const name =
    String(
      profile?.name
      ?? ""
    )
      .toLowerCase();

  if (
    profile?.id
      === "benchmark"
    || name.includes(
      "benchmark"
    )
  ) {
    return Gauge;
  }

  if (
    profile?.id
      === "modded"
    || name.includes(
      "mod"
    )
  ) {
    return Wrench;
  }

  return Settings2;
}


function profileSummary(
  profile
) {
  if (
    profile.launchMode
      === "launcher"
  ) {
    return "Standard launcher";
  }

  if (
    profile.executablePath
      ?.trim()
  ) {
    const parts =
      profile
        .executablePath
        .replaceAll(
          "/",
          "\\"
        )
        .split(
          "\\"
        );

    return parts[
      parts.length - 1
    ]
      || "Direct executable";
  }

  return "Direct executable — setup required";
}


function ProfileEditor({
  profile,
  isDefault,
  detectedExecutable,
  launching,
  onChange,
  onDelete,
  onDuplicate,
  onSetDefault,
  onLaunch,
}) {
  const [
    expanded,
    setExpanded,
  ] =
    useState(
      profile.id
        !== "normal"
    );

  const Icon =
    profileIcon(
      profile
    );

  const direct =
    profile.launchMode
      === "direct";

  return (
    <div
      className="
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
          p-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <button
          type="button"
          onClick={
            () =>
              setExpanded(
                (
                  value
                ) =>
                  !value
              )
          }
          className="
            flex
            min-w-0
            flex-1
            items-center
            gap-3
            text-left
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
              text-cyan-300
            "
          >
            <Icon
              className="h-4 w-4"
            />
          </div>

          <div
            className="
              min-w-0
              flex-1
            "
          >
            <div
              className="
                flex
                flex-wrap
                items-center
                gap-2
              "
            >
              <div
                className="
                  truncate
                  text-sm
                  font-semibold
                  text-white/80
                "
              >
                {profile.name}
              </div>

              {isDefault ? (
                <span
                  className="
                    inline-flex
                    items-center
                    gap-1
                    rounded-full
                    border
                    border-emerald-500/20
                    bg-emerald-500/[0.07]
                    px-2
                    py-0.5
                    text-[9px]
                    font-semibold
                    uppercase
                    tracking-wide
                    text-emerald-200/75
                  "
                >
                  <Check
                    className="h-3 w-3"
                  />

                  Default
                </span>
              ) : null}
            </div>

            <div
              className="
                mt-1
                truncate
                text-xs
                text-white/30
              "
            >
              {profileSummary(
                profile
              )}
            </div>
          </div>

          {expanded ? (
            <ChevronUp
              className="
                h-4
                w-4
                shrink-0
                text-white/25
              "
            />
          ) : (
            <ChevronDown
              className="
                h-4
                w-4
                shrink-0
                text-white/25
              "
            />
          )}
        </button>

        <div
          className="
            flex
            shrink-0
            flex-wrap
            items-center
            gap-2
          "
        >
          {!isDefault ? (
            <button
              type="button"
              onClick={
                onSetDefault
              }
              className="
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
                hover:text-white/70
              "
            >
              Set Default
            </button>
          ) : null}

          <button
            type="button"
            onClick={
              onLaunch
            }
            disabled={
              launching
            }
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-cyan-400/25
              bg-cyan-500/10
              px-3
              py-2
              text-xs
              font-semibold
              text-cyan-100/80
              hover:bg-cyan-500/15
              disabled:opacity-40
            "
          >
            {launching ? (
              <Loader2
                className="
                  h-3.5
                  w-3.5
                  animate-spin
                "
              />
            ) : (
              <Play
                className="
                  h-3.5
                  w-3.5
                  fill-current
                "
              />
            )}

            Launch
          </button>
        </div>
      </div>


      {expanded ? (
        <div
          className="
            border-t
            border-white/[0.07]
            px-4
            pb-4
            pt-4
          "
        >
          <div
            className="
              grid
              grid-cols-1
              gap-4
              xl:grid-cols-2
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
                Profile Name
              </div>

              <input
                value={
                  profile.name
                }
                onChange={
                  (event) =>
                    onChange({
                      ...profile,

                      name:
                        event.target
                          .value,
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
                  focus:border-cyan-400/30
                "
              />
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
                Launch Method
              </div>

              <select
                value={
                  profile.launchMode
                }
                onChange={
                  (event) =>
                    onChange({
                      ...profile,

                      launchMode:
                        event.target
                          .value,
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
                  focus:border-cyan-400/30
                "
              >
                <option value="launcher">
                  Standard Launcher
                </option>

                <option value="direct">
                  Direct Executable
                </option>
              </select>
            </label>
          </div>


          {direct ? (
            <div
              className="
                mt-4
                space-y-4
              "
            >
              <label>
                <div
                  className="
                    mb-1.5
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <span
                    className="
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-wide
                      text-white/30
                    "
                  >
                    Executable Path
                  </span>

                  {detectedExecutable ? (
                    <button
                      type="button"
                      onClick={
                        () =>
                          onChange({
                            ...profile,

                            executablePath:
                              detectedExecutable,
                          })
                      }
                      className="
                        text-[10px]
                        font-semibold
                        text-cyan-300/60
                        hover:text-cyan-200
                      "
                    >
                      Use Detected Executable
                    </button>
                  ) : null}
                </div>

                <input
                  value={
                    profile
                      .executablePath
                  }
                  onChange={
                    (event) =>
                      onChange({
                        ...profile,

                        executablePath:
                          event.target
                            .value,
                      })
                  }
                  placeholder="C:\Games\Example\Game.exe"
                  spellCheck={false}
                  className="
                    w-full
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-[#101722]
                    px-3
                    py-2.5
                    font-mono
                    text-xs
                    text-white/70
                    outline-none
                    placeholder:text-white/15
                    focus:border-cyan-400/30
                  "
                />
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
                  Custom Arguments
                </div>

                <input
                  value={
                    profile.arguments
                  }
                  onChange={
                    (event) =>
                      onChange({
                        ...profile,

                        arguments:
                          event.target
                            .value,
                      })
                  }
                  placeholder='Example: -dx12 -windowed -ResX=1920'
                  spellCheck={false}
                  className="
                    w-full
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-[#101722]
                    px-3
                    py-2.5
                    font-mono
                    text-xs
                    text-white/70
                    outline-none
                    placeholder:text-white/15
                    focus:border-cyan-400/30
                  "
                />
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
                  Working Directory
                  <span
                    className="
                      ml-2
                      normal-case
                      font-normal
                      tracking-normal
                      text-white/18
                    "
                  >
                    optional
                  </span>
                </div>

                <input
                  value={
                    profile
                      .workingDirectory
                  }
                  onChange={
                    (event) =>
                      onChange({
                        ...profile,

                        workingDirectory:
                          event.target
                            .value,
                      })
                  }
                  placeholder="Defaults to the executable's folder"
                  spellCheck={false}
                  className="
                    w-full
                    rounded-lg
                    border
                    border-white/[0.08]
                    bg-[#101722]
                    px-3
                    py-2.5
                    font-mono
                    text-xs
                    text-white/70
                    outline-none
                    placeholder:text-white/15
                    focus:border-cyan-400/30
                  "
                />
              </label>
            </div>
          ) : (
            <div
              className="
                mt-4
                rounded-lg
                border
                border-white/[0.06]
                bg-white/[0.015]
                px-3
                py-3
                text-xs
                leading-relaxed
                text-white/30
              "
            >
              Standard Launcher uses GameAtlas's existing store launch route. Custom executable paths and arguments are available in Direct Executable mode.
            </div>
          )}


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
                onDuplicate
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
                text-white/40
                hover:bg-white/[0.055]
                hover:text-white/65
              "
            >
              <Copy
                className="h-3.5 w-3.5"
              />

              Duplicate
            </button>

            {profile.id
              !== "normal" ? (
              <button
                type="button"
                onClick={
                  onDelete
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-red-500/15
                  bg-red-500/[0.035]
                  px-3
                  py-2
                  text-xs
                  font-semibold
                  text-red-200/45
                  hover:bg-red-500/[0.07]
                  hover:text-red-200/70
                "
              >
                <Trash2
                  className="h-3.5 w-3.5"
                />

                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}


export default function LaunchProfilesPanel({
  game,
}) {
  const [
    state,
    setState,
  ] =
    useState(
      () =>
        getLaunchProfileState(
          game
        )
    );

  const [
    detectedExecutable,
    setDetectedExecutable,
  ] =
    useState(
      null
    );

  const [
    launchingId,
    setLaunchingId,
  ] =
    useState(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      null
    );

  const [
    error,
    setError,
  ] =
    useState(
      null
    );


  useEffect(
    () => {
      setState(
        getLaunchProfileState(
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
      game?.name,
    ]
  );


  useEffect(
    () => {
      let cancelled =
        false;

      async function detect() {
        if (!game?.installPath) {
          setDetectedExecutable(
            null
          );

          return;
        }

        try {
          const result =
            await inspectLocalInstallation(
              game
            );

          if (!cancelled) {
            setDetectedExecutable(
              result?.executable
                ?.path
              ?? null
            );
          }
        } catch {
          if (!cancelled) {
            setDetectedExecutable(
              null
            );
          }
        }
      }

      detect();

      return () => {
        cancelled =
          true;
      };
    },
    [
      game?.id,
      game?.installPath,
    ]
  );


  const defaultProfile =
    useMemo(
      () =>
        state.profiles.find(
          (profile) =>
            profile.id
              === state
                .defaultProfileId
        )
        ?? state.profiles[0]
        ?? null,
      [
        state,
      ]
    );


  function persist(
    nextState,
    successMessage =
      "Launch profiles saved."
  ) {
    const saved =
      saveLaunchProfileState(
        game,
        nextState
      );

    setState(
      saved
    );

    setError(
      null
    );

    setMessage(
      successMessage
    );
  }


  function updateProfile(
    updated
  ) {
    const next = {
      ...state,

      profiles:
        state.profiles.map(
          (profile) =>
            profile.id
              === updated.id
              ? updated
              : profile
        ),
    };

    setState(
      next
    );

    saveLaunchProfileState(
      game,
      next
    );

    setMessage(
      null
    );

    setError(
      null
    );
  }


  function addProfile() {
    const profile =
      createLaunchProfile();

    persist(
      {
        ...state,

        profiles: [
          ...state.profiles,
          profile,
        ],
      },
      "Custom launch profile added."
    );
  }


  function duplicateProfile(
    profile
  ) {
    const copy = {
      ...profile,

      id:
        crypto.randomUUID(),

      name:
        `${profile.name} Copy`,
    };

    persist(
      {
        ...state,

        profiles: [
          ...state.profiles,
          copy,
        ],
      },
      `Duplicated "${profile.name}".`
    );
  }


  function deleteProfile(
    profile
  ) {
    const remaining =
      state.profiles.filter(
        (entry) =>
          entry.id
            !== profile.id
      );

    const defaultProfileId =
      state.defaultProfileId
        === profile.id
        ? remaining[0]?.id
          ?? "normal"
        : state.defaultProfileId;

    persist(
      {
        defaultProfileId,
        profiles:
          remaining,
      },
      `Deleted "${profile.name}".`
    );
  }


  function setDefault(
    profile
  ) {
    persist(
      {
        ...state,

        defaultProfileId:
          profile.id,
      },
      `"${profile.name}" is now the default Play Game profile.`
    );
  }


  async function launch(
    profile
  ) {
    setLaunchingId(
      profile.id
    );

    setMessage(
      null
    );

    setError(
      null
    );

    try {
      const result =
        await launchConfiguredProfile(
          game,
          profile
        );

      setMessage(
        result?.message
        ?? `Launched "${profile.name}".`
      );
    } catch (launchError) {
      logError(
        "[Launch Profiles] Launch failed:",
        launchError
      );

      setError(
        String(
          launchError
        )
      );
    } finally {
      setLaunchingId(
        null
      );
    }
  }


  function reset() {
    const confirmed =
      window.confirm(
        "Reset all launch profiles for this game to Normal, Modded, and Benchmark defaults?"
      );

    if (!confirmed) {
      return;
    }

    const next =
      resetLaunchProfiles(
        game
      );

    setState(
      next
    );

    setMessage(
      "Launch profiles reset."
    );

    setError(
      null
    );
  }


  return (
    <div>
      <div
        className="
          flex
          flex-col
          gap-4
          rounded-xl
          border
          border-cyan-500/10
          bg-cyan-500/[0.025]
          p-4
          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <div>
          <div
            className="
              text-sm
              font-semibold
              text-white/75
            "
          >
            Default: {defaultProfile?.name ?? "Normal"}
          </div>

          <div
            className="
              mt-1
              text-xs
              leading-relaxed
              text-white/30
            "
          >
            The main Play Game button uses the default profile. Direct profiles can use an alternate executable and custom arguments.
          </div>
        </div>

        <div
          className="
            flex
            shrink-0
            flex-wrap
            gap-2
          "
        >
          <button
            type="button"
            onClick={
              addProfile
            }
            className="
              inline-flex
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
              hover:bg-white/[0.055]
              hover:text-white/70
            "
          >
            <Plus
              className="h-3.5 w-3.5"
            />

            Add Profile
          </button>

          <button
            type="button"
            onClick={
              reset
            }
            className="
              inline-flex
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
              text-white/35
              hover:bg-white/[0.055]
              hover:text-white/60
            "
          >
            <RotateCcw
              className="h-3.5 w-3.5"
            />

            Reset
          </button>
        </div>
      </div>


      {message ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-emerald-500/15
            bg-emerald-500/[0.04]
            px-3
            py-2.5
            text-xs
            text-emerald-200/60
          "
        >
          {message}
        </div>
      ) : null}


      {error ? (
        <div
          className="
            mt-3
            rounded-lg
            border
            border-amber-500/20
            bg-amber-500/[0.05]
            px-3
            py-2.5
            text-xs
            leading-relaxed
            text-amber-200/70
          "
        >
          {error}
        </div>
      ) : null}


      <div
        className="
          mt-4
          space-y-3
        "
      >
        {state.profiles.map(
          (
            profile
          ) => (
            <ProfileEditor
              key={
                profile.id
              }
              profile={
                profile
              }
              isDefault={
                profile.id
                  === state
                    .defaultProfileId
              }
              detectedExecutable={
                detectedExecutable
              }
              launching={
                launchingId
                  === profile.id
              }
              onChange={
                updateProfile
              }
              onDelete={
                () =>
                  deleteProfile(
                    profile
                  )
              }
              onDuplicate={
                () =>
                  duplicateProfile(
                    profile
                  )
              }
              onSetDefault={
                () =>
                  setDefault(
                    profile
                  )
              }
              onLaunch={
                () =>
                  launch(
                    profile
                  )
              }
            />
          )
        )}
      </div>


      <div
        className="
          mt-4
          rounded-lg
          border
          border-white/[0.06]
          bg-black/10
          px-3
          py-3
          text-[10px]
          leading-relaxed
          text-white/22
        "
      >
        Launcher mode preserves GameAtlas's existing Steam, Epic, GOG, Ubisoft, EA, and Xbox launch behavior. Direct Executable mode is intended for modded executables, launch wrappers, benchmark modes, and games that accept command-line arguments. Some launcher-protected games may still require their normal store launcher.
      </div>
    </div>
  );
}
